#!/usr/bin/env node
/**
 * Provisions one agent: its key, its deployment .env, and its ERC-8004
 * identity, registered through the sponsored path so a new address needs no
 * ETH at all.
 *
 *   node scripts/provision-agent.mjs <slug> --name "<AGENT_NAME>" [--no-register]
 *
 * Every step is idempotent, so re-running it is how you resume:
 *
 *   1. Key. `.keys/<slug>.key` is used if it exists and generated only if it
 *      does not. A key is never overwritten — the address it controls owns an
 *      identity and is named on covenants, so replacing it would orphan both.
 *   2. Character. `agents/<slug>/system.md` must already exist (it is written
 *      from the agent's plan; see .claude/skills/new-agent at the repo root).
 *      This script will not invent one.
 *   3. Deployment env. `agents/<slug>/.env` is created from
 *      agents/.env.example if missing, with AGENT, PRIVATE_KEY and AGENT_NAME
 *      filled in. An existing file is only ever updated line by line.
 *   4. Identity. If the address already owns an identity, nothing is sent —
 *      registering twice creates a second identity, permanently. Otherwise
 *      `register` goes out via scripts/sponsored-send.mjs (the first sponsored
 *      call also carries the address's EIP-7702 delegation), and the new id is
 *      read from this UserOperation's own `Registered` log and written to
 *      AGENT_ID.
 *
 * Reads the shared .env (RPC_URL, IDENTITY_REGISTRY, ALCHEMY_API_KEY,
 * ALCHEMY_POLICY_ID). If the Gas Manager policy has a sender allowlist, add the
 * printed address to it before step 4 — run with --no-register first.
 */
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const KEYS_DIR = join(ROOT, ".keys");
const AGENTS_DIR = join(ROOT, "agents");
const SEND = join(ROOT, "scripts", "sponsored-send.mjs");

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]*$/;
const REGISTERED_TOPIC =
  "0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a";
// secp256k1 group order: a valid private key is in [1, n).
const CURVE_ORDER = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

const say = (message) => console.log(message);

function fail(message) {
  console.error(`provision-agent: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { register: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--name") args.name = argv[++i];
    else if (arg === "--no-register") args.register = false;
    else if (arg.startsWith("--")) fail(`unknown flag ${arg}`);
    else if (!args.slug) args.slug = arg;
    else fail(`unexpected argument ${arg}`);
  }
  return args;
}

async function cast(args) {
  try {
    const { stdout } = await run("cast", args);
    return stdout.trim();
  } catch (error) {
    const detail = (error.stderr || error.message || "").toString().trim().split("\n")[0];
    throw new Error(`cast ${args[0]} failed: ${detail}`);
  }
}

// --- 1. key ----------------------------------------------------------------

async function ensureKey(slug) {
  const path = join(KEYS_DIR, `${slug}.key`);

  if (existsSync(path)) {
    const key = (await readFile(path, "utf8")).trim();
    say(`key: using existing .keys/${slug}.key`);
    return { path, key: key.startsWith("0x") ? key : `0x${key}` };
  }

  let secret;
  do secret = BigInt(`0x${randomBytes(32).toString("hex")}`);
  while (secret === 0n || secret >= CURVE_ORDER);
  const key = `0x${secret.toString(16).padStart(64, "0")}`;

  await mkdir(KEYS_DIR, { recursive: true, mode: 0o700 });
  // "wx" fails if the file appeared in the meantime rather than overwriting it.
  await writeFile(path, `${key}\n`, { mode: 0o600, flag: "wx" });
  await chmod(path, 0o600);
  say(`key: generated .keys/${slug}.key`);
  return { path, key };
}

// --- 3. env file -----------------------------------------------------------

function setLine(text, name, value) {
  const line = `${name}=${value}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  return pattern.test(text) ? text.replace(pattern, () => line) : `${text.trimEnd()}\n${line}\n`;
}

const readLine = (text, name) => text.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";

async function ensureEnv(slug, key, name) {
  const path = join(AGENTS_DIR, slug, ".env");
  const existed = existsSync(path);
  let text = existed
    ? await readFile(path, "utf8")
    : await readFile(join(AGENTS_DIR, ".env.example"), "utf8");

  text = setLine(text, "AGENT", slug);
  if (readLine(text, "PRIVATE_KEY") && readLine(text, "PRIVATE_KEY") !== key) {
    fail(`agents/${slug}/.env holds a different PRIVATE_KEY than .keys/${slug}.key — resolve that by hand`);
  }
  text = setLine(text, "PRIVATE_KEY", key);
  if (name) text = setLine(text, "AGENT_NAME", JSON.stringify(name));

  await writeFile(path, text, { mode: 0o600 });
  say(`env: ${existed ? "updated" : "created"} agents/${slug}/.env`);
  return { path, text };
}

// --- 4. identity -----------------------------------------------------------

function sponsoredSend(to, data, keyFile) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [SEND, to, data, "--key-file", keyFile], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (code) => {
      let result = null;
      try {
        result = JSON.parse(out);
      } catch {
        // no JSON: failed before sending
      }
      resolvePromise({ code, result });
    });
  });
}

async function register(slug, keyFile, wallet, name, envPath) {
  const registry = process.env.IDENTITY_REGISTRY?.trim();
  const rpcUrl = process.env.RPC_URL?.trim();
  if (!registry || !rpcUrl) fail("IDENTITY_REGISTRY and RPC_URL must be set in .env");

  const owned = BigInt(
    (await cast(["call", registry, "balanceOf(address)(uint256)", wallet, "--rpc-url", rpcUrl]))
      .split(/\s/)[0],
  );
  if (owned > 0n) {
    say(`identity: ${wallet} already owns ${owned} identity(ies) — not registering again.`);
    say("  Recover the id with step 3 of the kudo-covenants skill and set AGENT_ID by hand.");
    return;
  }

  const metadata = `[(name,${await cast(["from-utf8", name])})]`;
  const data = await cast(["calldata", "register(string,(string,bytes)[])", "", metadata]);

  // Simulate first, as every write is.
  await cast(["call", registry, data, "--from", wallet, "--rpc-url", rpcUrl]);

  say("identity: registering through the sponsored path");
  const { code, result } = await sponsoredSend(registry, data, keyFile);
  if (code !== 0) {
    fail(
      code === 4
        ? "registration outcome unknown — do NOT re-run until balanceOf shows whether it landed"
        : `registration was not completed (exit ${code})`,
    );
  }

  const owner = `0x${wallet.slice(2).toLowerCase().padStart(64, "0")}`;
  const log = (result.logs ?? []).find(
    (l) =>
      l.address?.toLowerCase() === registry.toLowerCase() &&
      l.topics?.[0]?.toLowerCase() === REGISTERED_TOPIC &&
      l.topics?.[2]?.toLowerCase() === owner,
  );
  if (!log) {
    fail(`registered in ${result.transactionHash}, but no Registered log for ${wallet} — recover the id with the skill's step 3`);
  }

  const agentId = BigInt(log.topics[1]).toString();
  const text = setLine(await readFile(envPath, "utf8"), "AGENT_ID", agentId);
  await writeFile(envPath, text, { mode: 0o600 });
  say(`identity: agentId ${agentId} (tx ${result.transactionHash}), written to agents/${slug}/.env`);
}

// --- main ------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug || !SAFE_SLUG.test(args.slug)) {
    fail('usage: node scripts/provision-agent.mjs <slug> --name "<AGENT_NAME>" [--no-register]');
  }
  const { slug } = args;

  const sharedEnv = join(ROOT, ".env");
  if (existsSync(sharedEnv)) process.loadEnvFile(sharedEnv);

  const { path: keyFile, key } = await ensureKey(slug);
  const wallet = await cast(["wallet", "address", "--private-key", key]);
  say(`address: ${wallet}`);

  const system = join(AGENTS_DIR, slug, "system.md");
  if (!existsSync(system) || !(await readFile(system, "utf8")).trim()) {
    fail(`agents/${slug}/system.md is missing or empty — write it from the agent's plan first`);
  }
  say(`character: agents/${slug}/system.md`);

  const { path: envPath, text } = await ensureEnv(slug, key, args.name);
  const name = args.name || readLine(text, "AGENT_NAME").replace(/^"(.*)"$/, "$1");

  if (readLine(text, "AGENT_ID")) {
    say(`identity: AGENT_ID already set (${readLine(text, "AGENT_ID")}) — skipping registration`);
  } else if (!args.register) {
    say("identity: skipped (--no-register). Add the address above to the Gas Manager policy, then re-run.");
  } else {
    if (!name) fail("no AGENT_NAME — pass --name");
    await register(slug, keyFile, wallet, name, envPath);
  }

  say("");
  say("Still to do by hand:");
  say(`  - an admin grants AGENT_ROLE to ${wallet} on KUDO (the validator gets EVALUATOR_CONTRACT_ROLE instead)`);
  say(`  - fill JOBS, SKILLS and AGENT_ENDPOINT in agents/${slug}/.env`);
}

main().catch((error) => fail(error.message));
