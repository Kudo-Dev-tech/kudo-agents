/**
 * The gas tank: Kudo sponsors every launched agent's gas.
 *
 * The treasury sends each agent a small amount of ETH at launch, then refills
 * any running agent whose balance falls below a threshold. The agent pays gas
 * from its own wallet as usual, so every transaction is an ordinary one from
 * the agent's EOA - `msg.sender` is the agent, and Kudo, the identity registry
 * and any other contract see exactly what they would see unsponsored.
 *
 * What the gas tank cannot do is restrict what the ETH is spent on: once it is
 * in the agent's wallet the agent could send it anywhere. So refills are small
 * and capped per agent per UTC day, and every transfer is written to a ledger.
 */
import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { addressOf, balanceOf, ethToWei, sendEth, weiToEth } from "./chain.ts";
import { config } from "./config.ts";
import { listAgents } from "./store.ts";

interface Transfer {
  slug: string;
  to: string;
  wei: string;
  tx: string;
  reason: "initial" | "refill";
  at: string;
}

const ledgerFile = () => join(config.dataDir, "gas-ledger.json");

async function readLedger(): Promise<Transfer[]> {
  try {
    return JSON.parse(await readFile(ledgerFile(), "utf8")) as Transfer[];
  } catch {
    return [];
  }
}

async function appendLedger(entry: Transfer): Promise<void> {
  const ledger = await readLedger();
  ledger.push(entry);
  const tmp = `${ledgerFile()}.tmp`;
  await writeFile(tmp, JSON.stringify(ledger, null, 2));
  await rename(tmp, ledgerFile());
}

const today = () => new Date().toISOString().slice(0, 10);

/** What the tank has sent this agent so far today, initial funding included. */
export async function sentToday(slug: string): Promise<bigint> {
  const day = today();
  return (await readLedger())
    .filter((entry) => entry.slug === slug && entry.at.startsWith(day))
    .reduce((sum, entry) => sum + BigInt(entry.wei), 0n);
}

/**
 * Every treasury transfer goes through here, one at a time. Two in flight from
 * the same key would race for the same nonce and one would fail.
 */
let treasury: Promise<unknown> = Promise.resolve();

function serially<T>(work: () => Promise<T>): Promise<T> {
  const next = treasury.then(work, work);
  treasury = next.catch(() => undefined);
  return next;
}

async function transfer(slug: string, to: string, wei: bigint, reason: Transfer["reason"]) {
  return serially(async () => {
    const cap = ethToWei(config.gas.dailyCapEth);
    const sent = await sentToday(slug);
    if (sent + wei > cap) {
      throw new Error(
        `daily gas cap reached for ${slug}: ${weiToEth(sent)} of ${config.gas.dailyCapEth} ETH sent today`,
      );
    }

    const tx = await sendEth(config.gas.treasuryKey, to, wei);
    await appendLedger({ slug, to, wei: wei.toString(), tx, reason, at: new Date().toISOString() });
    console.log(`gas tank: sent ${weiToEth(wei)} ETH to ${slug} (${reason}) in ${tx}`);
    return tx;
  });
}

/** Whether this agent has had its initial funding, so a retried launch is not funded twice. */
export async function wasFunded(slug: string): Promise<boolean> {
  return (await readLedger()).some((entry) => entry.slug === slug && entry.reason === "initial");
}

/** Funds a new agent before it sends its first transaction. */
export function fundNewAgent(slug: string, address: string): Promise<string> {
  return transfer(slug, address, ethToWei(config.gas.initialEth), "initial");
}

/** One pass over every running agent, refilling the ones that are low. */
async function refillRound(): Promise<void> {
  const threshold = ethToWei(config.gas.refillBelowEth);
  const amount = ethToWei(config.gas.refillEth);

  for (const agent of await listAgents()) {
    if (agent.stage !== "running") continue;
    try {
      if ((await balanceOf(agent.address)) >= threshold) continue;
      await transfer(agent.slug, agent.address, amount, "refill");
    } catch (error) {
      // One agent at its cap, or one failed transfer, costs that agent a round
      // and nobody else theirs.
      console.error(`gas tank: ${agent.slug}: ${(error as Error).message}`);
    }
  }
}

export interface TreasuryStatus {
  address: string;
  balanceEth: string;
  low: boolean;
}

export async function treasuryStatus(): Promise<TreasuryStatus> {
  const address = await addressOf(config.gas.treasuryKey);
  const balance = await balanceOf(address);
  // Low means it could not fund one more launch and one more refill.
  const low = balance < ethToWei(config.gas.initialEth) + ethToWei(config.gas.refillEth);
  return { address, balanceEth: weiToEth(balance), low };
}

/** Starts the refill loop. Rounds never overlap; a failed round is logged and skipped. */
export function startGasTank(): { stop(): void } {
  let running = true;

  void (async () => {
    console.log(`gas tank: checking balances every ${config.gas.checkSeconds}s`);
    while (running) {
      await refillRound().catch((error) => console.error(`gas tank: ${(error as Error).message}`));
      const until = Date.now() + config.gas.checkSeconds * 1000;
      while (running && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, Math.min(1000, until - Date.now())));
      }
    }
  })();

  return {
    stop() {
      running = false;
    },
  };
}
