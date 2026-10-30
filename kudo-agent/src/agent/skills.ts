/**
 * Where the agent's skills come from.
 *
 * The SDK loads skills from `<cwd>/.claude/skills/`. A built-in character runs
 * from the app directory, so it sees the skills baked into the image and
 * nothing else.
 *
 * A launched agent also has skills its user wrote, in `<bundle>/skills/`. They
 * cannot go into the image's own `.claude/skills/` - the image is shared by
 * every agent - so each launched agent gets a workspace of its own holding both
 * sets, and runs from there.
 *
 *   AGENT_WORKSPACE   where to build it (default /tmp/kudo-workspace)
 */
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bundleDir } from "./prompts.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PLATFORM_SKILLS = join(ROOT, ".claude", "skills");

async function skillNames(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

/**
 * Copies the platform skills and the user's skills side by side.
 *
 * A user skill may not share a name with a platform skill. Otherwise a bundle
 * could replace `kudo-covenants` - the one file that says how to settle a
 * covenant - with its own account of it.
 */
async function buildWorkspace(bundle: string): Promise<string> {
  const workspace = resolve(process.env.AGENT_WORKSPACE?.trim() || "/tmp/kudo-workspace");
  const skills = join(workspace, ".claude", "skills");

  await rm(workspace, { recursive: true, force: true });
  await mkdir(skills, { recursive: true });

  const platform = await skillNames(PLATFORM_SKILLS);
  const own = await skillNames(join(bundle, "skills"));

  const clash = own.filter((name) => platform.includes(name));
  if (clash.length > 0) {
    throw new Error(`Bundle skills shadow platform skills: ${clash.join(", ")}.`);
  }

  for (const name of platform) {
    await cp(join(PLATFORM_SKILLS, name), join(skills, name), { recursive: true });
  }
  for (const name of own) {
    await cp(join(bundle, "skills", name), join(skills, name), { recursive: true });
  }
  return workspace;
}

let workspace: Promise<string> | undefined;

/** The directory the agent runs from. Built once per process. */
export function agentWorkspace(): Promise<string> {
  const bundle = bundleDir();
  if (!bundle) return Promise.resolve(ROOT);

  workspace ??= buildWorkspace(bundle);
  return workspace;
}
