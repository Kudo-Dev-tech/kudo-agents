/**
 * Turns what a user submitted into an agent bundle on disk.
 *
 * The bundle is what kudo-agent reads when AGENT_BUNDLE_DIR is set:
 *
 *   system.md                its system prompt
 *   skills/<name>/SKILL.md   its own skills
 *   prompts/<name>.txt       its own task prompts
 *
 * Everything is validated here, before anything is funded or registered, so a
 * bad submission costs nothing.
 */
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { config } from "./config.ts";

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Skills baked into the kudo-agent image. A user skill may not reuse one of
 * these names - kudo-agent refuses to start if one does (src/agent/skills.ts),
 * and this catches it before the launch spends any gas.
 */
const PLATFORM_SKILLS = ["kudo-covenants", "twitter", "chain-forensics", "kudo-validation"];

/** Shared task prompts in kudo-agent/prompts/ that a launched agent may schedule. */
export const BUILT_IN_TASKS = {
  "settle-due": "Keep the promises this agent owes once they are due.",
  "take-work": "Find one unclaimed open ask that fits this agent, perform it and attest it.",
} as const;

/** The built-in characters. A launched agent may not take one of their names. */
const RESERVED_SLUGS = ["sloane", "vale", "gray", "kit", "shinichi", "validator", "marlowe"];

const MIN_JOB_SECONDS = 60;
const MAX_SYSTEM_PROMPT = 32 * 1024;
const MAX_SKILL = 64 * 1024;
const MAX_SKILLS = 10;
const MAX_JOBS = 5;

export interface LaunchRequest {
  name: string;
  systemPrompt: string;
  skills: Array<{ content: string }>;
  chainForensics: boolean;
  jobs: Array<{ task: string; seconds: number; prompt?: string }>;
  twitter?: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessTokenSecret: string;
    handle: string;
  } | null;
}

export interface Bundle {
  name: string;
  systemPrompt: string;
  skills: Array<{ name: string; content: string }>;
  enabledSkills: string[];
  prompts: Array<{ name: string; text: string }>;
  jobs: string;
  twitter: LaunchRequest["twitter"];
}

export class InvalidBundle extends Error {}

const fail = (message: string): never => {
  throw new InvalidBundle(message);
};

const singleLine = (value: string, what: string) =>
  /[\r\n]/.test(value) ? fail(`${what} must be a single line.`) : value;

/** Reads `name:` and `description:` out of a SKILL.md's frontmatter. */
function skillName(content: string, index: number): string {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!match) fail(`Skill ${index + 1} has no frontmatter. Start it with ---, name: and description:.`);

  const field = (key: string) =>
    new RegExp(`^${key}:\\s*(.+)$`, "m").exec(match![1])?.[1].trim().replace(/^["']|["']$/g, "");

  const name = field("name") ?? fail(`Skill ${index + 1} has no name: in its frontmatter.`);
  if (!field("description")) fail(`Skill "${name}" has no description: - the model uses it to decide when to load the skill.`);
  if (!SAFE_NAME.test(name)) fail(`Skill name "${name}" must be lowercase letters, digits and dashes.`);
  if (PLATFORM_SKILLS.includes(name)) fail(`Skill name "${name}" is taken by a platform skill.`);
  return name;
}

export function slugFor(name: string, taken: string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "agent";

  let slug = base;
  for (let n = 2; RESERVED_SLUGS.includes(slug) || taken.includes(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export function validate(input: LaunchRequest): Bundle {
  const name = singleLine(String(input.name ?? "").trim(), "Name");
  if (!name || name.length > 48) fail("Name must be 1 to 48 characters.");

  const systemPrompt = String(input.systemPrompt ?? "").trim();
  if (!systemPrompt) fail("The system prompt is empty.");
  if (systemPrompt.length > MAX_SYSTEM_PROMPT) fail(`The system prompt is over ${MAX_SYSTEM_PROMPT / 1024} KB.`);

  const submitted = Array.isArray(input.skills) ? input.skills : [];
  if (submitted.length > MAX_SKILLS) fail(`At most ${MAX_SKILLS} skills.`);
  const skills = submitted.map((skill, index) => {
    const content = String(skill?.content ?? "");
    if (content.length > MAX_SKILL) fail(`Skill ${index + 1} is over ${MAX_SKILL / 1024} KB.`);
    return { name: skillName(content, index), content };
  });
  const names = skills.map((skill) => skill.name);
  const duplicate = names.find((n, i) => names.indexOf(n) !== i);
  if (duplicate) fail(`Two skills are both named "${duplicate}".`);

  const twitter = input.twitter ?? null;
  if (twitter) {
    const values = [twitter.apiKey, twitter.apiSecret, twitter.accessToken, twitter.accessTokenSecret, twitter.handle];
    // All five or none: with some set, X answers 403 and it reads like a
    // permissions problem rather than a missing value.
    if (values.some((value) => !String(value ?? "").trim())) fail("X credentials need all five fields, or none.");
    values.forEach((value) => singleLine(String(value), "X credentials"));
  }

  const submittedJobs = Array.isArray(input.jobs) ? input.jobs : [];
  if (submittedJobs.length > MAX_JOBS) fail(`At most ${MAX_JOBS} scheduled tasks.`);

  const prompts: Bundle["prompts"] = [];
  const jobs = submittedJobs.map((job, index) => {
    const seconds = Number(job?.seconds);
    if (!Number.isInteger(seconds) || seconds < MIN_JOB_SECONDS) {
      fail(`Task ${index + 1} must run at most once every ${MIN_JOB_SECONDS} seconds - each run is a model call.`);
    }

    if (job.task in BUILT_IN_TASKS) return `${job.task}:${seconds}`;

    // A custom task: the user's own prompt, written into the bundle.
    const task = String(job.task ?? "").trim();
    if (!SAFE_NAME.test(task)) fail(`Task name "${task}" must be lowercase letters, digits and dashes.`);
    const text = String(job.prompt ?? "").trim();
    if (!text) fail(`Task "${task}" has no prompt.`);
    if (prompts.some((p) => p.name === task)) fail(`Two tasks are both named "${task}".`);
    prompts.push({ name: task, text });
    return `${task}:${seconds}`;
  });

  const enabledSkills = [
    "kudo-covenants",
    ...(twitter ? ["twitter"] : []),
    ...(input.chainForensics ? ["chain-forensics"] : []),
    ...names,
  ];

  return { name, systemPrompt, skills, enabledSkills, prompts, jobs: jobs.join(","), twitter };
}

/** Writes the bundle the agent container mounts read-only at /bundle. */
export async function writeBundle(dir: string, bundle: Bundle): Promise<void> {
  const root = join(dir, "bundle");
  await mkdir(join(root, "skills"), { recursive: true });
  await mkdir(join(root, "prompts"), { recursive: true });

  await writeFile(join(root, "system.md"), `${bundle.systemPrompt}\n`);
  for (const skill of bundle.skills) {
    await mkdir(join(root, "skills", skill.name), { recursive: true });
    await writeFile(join(root, "skills", skill.name, "SKILL.md"), skill.content);
  }
  for (const prompt of bundle.prompts) {
    await writeFile(join(root, "prompts", `${prompt.name}.txt`), `${prompt.text}\n`);
  }
}

/**
 * Writes the container's environment, key included. Mode 600: it is the one
 * file on this host that holds an agent's key.
 */
export async function writeAgentEnv(
  dir: string,
  values: { slug: string; bundle: Bundle; privateKey: string; agentId: string },
): Promise<string> {
  const { slug, bundle, privateKey, agentId } = values;
  const env: Record<string, string> = {
    PORT: "3000",
    AGENT: slug,
    AGENT_BUNDLE_DIR: "/bundle",
    AGENT_NAME: bundle.name,
    AGENT_ID: agentId,
    PRIVATE_KEY: privateKey,
    SKILLS: bundle.enabledSkills.join(","),
    // Empty JOBS falls back to kudo-agent's legacy single settler, so an agent
    // with no scheduled tasks says so explicitly.
    ...(bundle.jobs ? { JOBS: bundle.jobs } : { TICK_INTERVAL_SECONDS: "0" }),
    ANTHROPIC_API_KEY: config.agent.anthropicApiKey,
    RPC_URL: config.chain.rpcUrl,
    KUDO: config.chain.kudo,
    IDENTITY_REGISTRY: config.chain.identityRegistry,
    USDG: config.chain.usdg,
    VAULT: config.chain.vault,
    ...(bundle.twitter && {
      TWITTER_API_KEY: bundle.twitter.apiKey,
      TWITTER_API_SECRET_KEY: bundle.twitter.apiSecret,
      TWITTER_ACCESS_TOKEN: bundle.twitter.accessToken,
      TWITTER_ACCESS_TOKEN_SECRET: bundle.twitter.accessTokenSecret,
      TWITTER_HANDLE: bundle.twitter.handle.replace(/^@/, ""),
    }),
  };

  const path = join(dir, "agent.env");
  const body = Object.entries(env)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  await writeFile(path, `${body}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
  return path;
}
