/**
 * Prompts live on disk as plain text, so an operational instruction is a file
 * in version control rather than a string buried in code.
 *
 * The system prompt is assembled from two files:
 *
 *   agents/_common.md          what every agent is told - the covenant model,
 *                              the honesty rules, how to work at the shell
 *   agents/<AGENT>/system.md   who this one is, and nothing else
 *
 * Splitting it that way is the point of the agents/ directory. Every CVM runs
 * the same image, pinned by the same digest, and `AGENT` is the only thing that
 * makes one of them Haibara - so the rules cannot drift between agents, because
 * there is only one copy of them.
 *
 * Task prompts (prompts/<name>.txt) are shared for the same reason: what the
 * settler does each round should not depend on who is settling.
 *
 * An agent started by the launcher has no directory in agents/ - its user wrote
 * it. AGENT_BUNDLE_DIR then points at the bundle the launcher mounted:
 *
 *   <bundle>/system.md          who this one is, in its user's words
 *   <bundle>/prompts/*.txt      its own task prompts
 *   <bundle>/skills/<name>/     its own skills (see skills.ts)
 *
 * and agents/_launched.md is placed between the two, so a launched agent is
 * told what the platform does for it (gas) before it reads its character.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS_DIR = join(ROOT, "agents");
const PROMPTS_DIR = join(ROOT, "prompts");

const SAFE_NAME = /^[a-z0-9][a-z0-9-]*$/i;

/** The launcher's bundle for this agent, or undefined for a built-in character. */
export function bundleDir(): string | undefined {
  const dir = process.env.AGENT_BUNDLE_DIR?.trim();
  return dir ? resolve(dir) : undefined;
}

/** Directory name of the agent this process is running as. */
export function agentSlug(): string {
  const slug = process.env.AGENT?.trim().toLowerCase();

  if (!slug) {
    throw new Error("AGENT is not set — it selects which agents/<slug>/ to run as.");
  }
  if (!SAFE_NAME.test(slug)) {
    throw new Error(`AGENT="${slug}" is not a valid directory name.`);
  }
  return slug;
}

/** Every agent this image can run as, for error messages and startup checks. */
export async function availableAgents(): Promise<string[]> {
  const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .sort();
}

/**
 * The agent's standing instructions: the shared base, then its character.
 *
 * Order matters. The character comes last so that where the two touch - voice,
 * register, what it will and will not claim - the specific one is what the
 * model read most recently.
 */
export async function loadSystemPrompt(): Promise<string> {
  const slug = agentSlug();
  const bundle = bundleDir();

  const common = await readFile(join(AGENTS_DIR, "_common.md"), "utf8");

  if (bundle) {
    const launched = await readFile(join(AGENTS_DIR, "_launched.md"), "utf8");
    const character = await readFile(join(bundle, "system.md"), "utf8").catch(() => {
      throw new Error(`No system.md in the bundle at ${bundle}.`);
    });
    return [common, launched, character].map((part) => part.trim()).join("\n\n---\n\n");
  }

  let character: string;
  try {
    character = await readFile(join(AGENTS_DIR, slug, "system.md"), "utf8");
  } catch {
    const known = (await availableAgents()).join(", ");
    throw new Error(`No agents/${slug}/system.md. Available: ${known}.`);
  }

  return `${common.trim()}\n\n---\n\n${character.trim()}`;
}

/**
 * A named task prompt, looked up in two places:
 *
 *   agents/<AGENT>/prompts/<name>.txt   this agent's own work
 *   prompts/<name>.txt                  work several agents share
 *
 * A launched agent's own work lives in its bundle instead of agents/<AGENT>/.
 *
 * The agent's own directory wins. A prompt that only one agent should ever run
 * lives only there, so another agent configured to run it fails at the first
 * tick rather than attempting something it has no business doing — `validate`
 * belongs to the validator, who alone holds the evaluator role.
 *
 * Prompts several agents share stay in prompts/, for the same reason the rules
 * live in one _common.md: a second copy is a copy that drifts.
 */
export async function loadPrompt(name: string): Promise<string> {
  if (!SAFE_NAME.test(name)) {
    throw new Error(`Invalid prompt name "${name}" — use letters, digits and dashes.`);
  }

  const slug = agentSlug();
  const bundle = bundleDir();
  const own = bundle ? join(bundle, "prompts") : join(AGENTS_DIR, slug, "prompts");
  const candidates = [join(own, `${name}.txt`), join(PROMPTS_DIR, `${name}.txt`)];

  for (const path of candidates) {
    try {
      return (await readFile(path, "utf8")).trim();
    } catch {
      // try the next location
    }
  }

  throw new Error(
    `No prompt "${name}" for ${slug}. Looked in ${own}/ and prompts/.`,
  );
}
