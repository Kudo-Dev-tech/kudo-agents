/**
 * What the launcher knows about each agent, on disk under DATA_DIR:
 *
 *   agents.json                 one record per agent (no keys)
 *   agents/<slug>/bundle/       what the agent container mounts at /bundle
 *   agents/<slug>/secrets.json  its key and submission, for retries (mode 600)
 *   agents/<slug>/agent.env     its container environment, key included (mode 600)
 *   gas-ledger.json             what the gas tank has sent (gas-tank.ts)
 *
 * Keys live only in the two mode-600 files, never in agents.json, so a record
 * can be served to the UI as it stands.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { config } from "./config.ts";

export type Stage =
  | "funding"
  | "registering"
  | "granting-role"
  | "starting"
  | "running"
  | "stopped"
  | "failed";

export interface AgentRecord {
  slug: string;
  name: string;
  address: string;
  agentId: string | null;
  port: number;
  skills: string[];
  jobs: string;
  stage: Stage;
  error: string | null;
  createdAt: string;
}

const file = () => join(config.dataDir, "agents.json");

export const agentDir = (slug: string) => join(config.dataDir, "agents", slug);

let records: Map<string, AgentRecord> | undefined;

async function load(): Promise<Map<string, AgentRecord>> {
  if (records) return records;
  try {
    const list = JSON.parse(await readFile(file(), "utf8")) as AgentRecord[];
    records = new Map(list.map((record) => [record.slug, record]));
  } catch {
    records = new Map();
  }
  return records;
}

/** Writes are serialised, and each replaces the file whole, so a crash leaves the old one. */
let writing: Promise<void> = Promise.resolve();

function persist(): Promise<void> {
  writing = writing.then(async () => {
    await mkdir(config.dataDir, { recursive: true });
    const tmp = `${file()}.tmp`;
    await writeFile(tmp, JSON.stringify([...records!.values()], null, 2));
    await rename(tmp, file());
  });
  return writing;
}

export async function listAgents(): Promise<AgentRecord[]> {
  return [...(await load()).values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAgent(slug: string): Promise<AgentRecord | undefined> {
  return (await load()).get(slug);
}

export async function saveAgent(record: AgentRecord): Promise<void> {
  (await load()).set(record.slug, record);
  await persist();
}

export async function updateAgent(slug: string, change: Partial<AgentRecord>): Promise<AgentRecord> {
  const current = (await load()).get(slug);
  if (!current) throw new Error(`No agent "${slug}".`);
  const next = { ...current, ...change };
  await saveAgent(next);
  return next;
}

/** The next free host port. Ports are never reused, so a stopped agent keeps its own. */
export async function nextPort(): Promise<number> {
  const used = [...(await load()).values()].map((record) => record.port);
  return used.length === 0 ? config.agent.portBase : Math.max(...used) + 1;
}
