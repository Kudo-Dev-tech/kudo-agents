/**
 * Launching one agent, step by step:
 *
 *   1. validate the submission and write its bundle      (free)
 *   2. create the agent's wallet
 *   3. fund it from the gas tank                         (treasury pays)
 *   4. register its ERC-8004 identity                    (agent's key, sponsored gas)
 *   5. grant AGENT_ROLE, if the launcher holds an admin key
 *   6. start its container
 *
 * Step 1 happens before the request returns, so a bad submission is a 400 and
 * costs nothing. Steps 2-6 run in the background; the record's `stage` says how
 * far they got, and the UI polls it.
 *
 * The key is written to disk the moment the wallet exists, before it is funded.
 * A launch that fails after that point can be retried: each step checks the
 * chain or the ledger first and skips what already happened, so a retry never
 * funds or registers twice.
 */
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { InvalidBundle, slugFor, validate, writeAgentEnv, writeBundle, type Bundle, type LaunchRequest } from "./bundle.ts";
import { grantAgentRole, hasAgentRole, identityCount, newWallet, registerIdentity } from "./chain.ts";
import { config } from "./config.ts";
import { fundNewAgent, wasFunded } from "./gas-tank.ts";
import { startContainer } from "./runtime.ts";
import { agentDir, getAgent, listAgents, nextPort, saveAgent, updateAgent, type AgentRecord } from "./store.ts";

export { InvalidBundle };

interface Secrets {
  privateKey: string;
  bundle: Bundle;
}

/** The agent's key and its validated submission (X credentials included). Mode 600. */
const secretsFile = (slug: string) => join(agentDir(slug), "secrets.json");

async function saveSecrets(slug: string, secrets: Secrets): Promise<void> {
  await writeFile(secretsFile(slug), JSON.stringify(secrets), { mode: 0o600 });
  await chmod(secretsFile(slug), 0o600);
}

/** One launch at a time, so two cannot claim the same slug or port. */
let launching: Promise<unknown> = Promise.resolve();

export function launch(input: LaunchRequest): Promise<AgentRecord> {
  const next = launching.then(() => prepare(input));
  launching = next.catch(() => undefined);
  return next;
}

async function prepare(input: LaunchRequest): Promise<AgentRecord> {
  const bundle = validate(input);
  const slug = slugFor(bundle.name, (await listAgents()).map((agent) => agent.slug));
  const dir = agentDir(slug);

  await mkdir(dir, { recursive: true });
  await writeBundle(dir, bundle);

  const wallet = await newWallet();
  await saveSecrets(slug, { privateKey: wallet.privateKey, bundle });
  const record: AgentRecord = {
    slug,
    name: bundle.name,
    address: wallet.address,
    agentId: null,
    port: await nextPort(),
    skills: bundle.enabledSkills,
    jobs: bundle.jobs,
    stage: "funding",
    error: null,
    createdAt: new Date().toISOString(),
  };
  await saveAgent(record);

  void provision(record, bundle, wallet.privateKey);
  return record;
}

async function provision(record: AgentRecord, bundle: Bundle, privateKey: string): Promise<void> {
  const { slug, address } = record;
  const step = (stage: AgentRecord["stage"]) => updateAgent(slug, { stage });

  try {
    if (!(await wasFunded(slug))) await fundNewAgent(slug, address);

    await step("registering");
    // Registering twice mints a second identity, which cannot be undone - so a
    // retry reuses the id from the first attempt, and a wallet that owns an
    // identity we have no id for stops here rather than guessing.
    let agentId = (await getAgent(slug))?.agentId ?? null;
    if (!agentId) {
      if ((await identityCount(address)) > 0n) {
        throw new Error(`${address} already owns an identity the launcher has no id for.`);
      }
      agentId = await registerIdentity(privateKey, bundle.name);
      await updateAgent(slug, { agentId });
    }

    if (config.chain.adminKey) {
      await step("granting-role");
      if (!(await hasAgentRole(address))) await grantAgentRole(config.chain.adminKey, address);
    }

    await step("starting");
    const envFile = await writeAgentEnv(agentDir(slug), { slug, bundle, privateKey, agentId });
    await startContainer(slug, record.port, envFile);

    await step("running");
    console.log(`launched ${slug} as agent ${agentId} (${address}) on :${record.port}`);
  } catch (error) {
    const message = (error as Error).message;
    console.error(`launch of ${slug} failed: ${message}`);
    await updateAgent(slug, { stage: "failed", error: message });
  }
}

/** Picks a failed launch up where it stopped. */
export async function retry(slug: string): Promise<AgentRecord> {
  const record = await getAgent(slug);
  if (!record) throw new InvalidBundle(`No agent "${slug}".`);
  if (record.stage !== "failed") throw new InvalidBundle(`${slug} has not failed - it is ${record.stage}.`);

  const secrets = JSON.parse(await readFile(secretsFile(slug), "utf8")) as Secrets;
  const resumed = await updateAgent(slug, { stage: "funding", error: null });
  void provision(resumed, secrets.bundle, secrets.privateKey);
  return resumed;
}
