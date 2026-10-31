/**
 * The agent.
 *
 * One function: give it a prompt, get its answer back. There are no custom
 * tools — it works the way a person would at a shell, with `cast` for the chain
 * and `node` to sign X API requests. What it knows lives in .claude/skills/.
 */
import {
  query,
  type Options,
  type SDKAssistantMessage,
  type SDKResultMessage,
} from "@anthropic-ai/claude-agent-sdk";

import { loadSystemPrompt } from "./prompts.ts";

export { loadPrompt } from "./prompts.ts";

const DEFAULT_SKILLS = ["kudo-covenants", "twitter"];

/**
 * Skills this agent is given, from SKILLS, comma separated.
 *
 * Exported because config.ts warns at startup when an agent is given a skill
 * whose credential is missing — which it can only know by reading the same
 * list this does.
 */
export function configuredSkills(): string[] {
  const raw = process.env.SKILLS?.trim();
  if (!raw) return DEFAULT_SKILLS;

  const skills = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (skills.length === 0) {
    throw new Error('SKILLS is set but names none — unset it for the default.');
  }
  return skills;
}

/** Keeps a long run alive through slow RPC calls and a flaky network. */
const RESILIENCE_ENV = {
  API_TIMEOUT_MS: "120000",
  CLAUDE_CODE_MAX_RETRIES: "2",
  CLAUDE_ENABLE_STREAM_WATCHDOG: "1",
  CLAUDE_STREAM_IDLE_TIMEOUT_MS: "300000",
};

function agentOptions(systemPrompt: string): Options {
  return {
    // Haiku 4.5 is the cheapest current model ($1/$5 per MTok vs Opus 5's
    // $5/$25). Note its context window is 200K, not 1M: a long settlement
    // round that loads a skill and pages through chain output has far less
    // headroom here than it did on Opus.
    model: "claude-haiku-4-5",
    systemPrompt,

    // The CLI scans .claude/skills/ relative to the working directory — that
    // exact path, not a plain skills/ — and registers the Skill tool, which
    // the model calls to pull a SKILL.md into context. Nothing here reads
    // those files; the SDK does.
    //
    // `skills` selects which of the discovered skills this agent gets, because
    // they are not all for everyone: kudo-validation describes closing
    // covenants, which only the evaluator can do, and handing it to a trader
    // would describe a power it does not have.
    //
    // It is also what permits the Skill tool. Listing "Skill" in allowedTools
    // is deprecated in favour of this option, which is why allowedTools below
    // names only Bash and the agent can still load a skill under "dontAsk".
    //
    // settingSources is the discovery gate: [] finds nothing on disk, and
    // omitting it defaults to the same as ["project"]. Stated explicitly so
    // the behaviour is pinned here rather than inherited from a default.
    settingSources: ["project"],
    skills: configuredSkills(),

    // Vercel's MCP server, for the agent that deploys. Opt-in per agent via
    // VERCEL_TOKEN: unset, and no server is configured, so no mcp__vercel__*
    // tool is advertised and nothing about the other agents changes.
    //
    // Its hosted endpoint is an OAuth protected resource, but a plain account
    // token from vercel.com/account/settings/tokens authenticates as the
    // bearer — verified against `initialize`, which answers 200. That is what
    // makes it usable with no human to complete a consent flow.
    //
    // Note what this costs: the server advertises its whole surface on every
    // request, in every run, including the ones that never deploy.
    ...(process.env.VERCEL_TOKEN?.trim()
      ? {
          mcpServers: {
            vercel: {
              type: "http" as const,
              url: "https://mcp.vercel.com",
              headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN.trim()}` },
            },
          },
        }
      : {}),

    // The shell is nearly the whole tool surface.
    //
    // `allowedTools` is an auto-approve list, not a filter: on its own it still
    // leaves every other built-in tool, and any connector on the API key's
    // account, advertised to the model. Denying them explicitly takes the tool
    // list down to Bash, Skill and whatever MCP server is configured above.
    //
    // The deny list cannot be a blanket `mcp__*` any more, because that would
    // also match the Vercel tools we are deliberately adding. So connectors
    // inherited from the API key's account are denied by their own prefixes
    // instead — add one here for any connector that account gains, because an
    // unlisted one is advertised to the model.
    allowedTools: ["Bash", "mcp__vercel"],
    disallowedTools: [
      "Read",
      "Write",
      "Edit",
      "WebFetch",
      "WebSearch",
      // Four MCP resource tools, advertised whenever a server is configured.
      // The mcp__* pattern does not match these names.
      "ListMcpResourcesTool",
      "ReadMcpResourceDirTool",
      "ReadMcpResourceTool",
      "WaitForMcpServers",
      "Task",
      // Haiku 4.5 advertises these where Opus 5 does not — the exposed tool
      // set is model-dependent, so re-check it when changing `model`.
      "TaskCreate",
      "TaskGet",
      "TaskList",
      "TaskUpdate",
      "Artifact",
      "ArtifactComments",
      "ArtifactData",
      "CronCreate",
      "CronDelete",
      "CronList",
      "DesignSync",
      "EnterWorktree",
      "ExitWorktree",
      "ListAgents",
      "Monitor",
      "NotebookEdit",
      "PushNotification",
      "RemoteTrigger",
      "ReportFindings",
      "ScheduleWakeup",
      "SendMessage",
      "TaskStop",
      "ToolSearch",
      "Workflow",
    ],

    // Nobody is at the keyboard, so deny anything not pre-approved.
    permissionMode: "dontAsk",

    maxTurns: 40,

    env: { ...process.env, ...RESILIENCE_ENV },
  };
}

/** The prose of one assistant turn. Tool calls and thinking are not included. */
function proseOf(message: SDKAssistantMessage): string {
  return message.message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

export class AgentRunError extends Error {}

/**
 * What the round cost, on one line.
 *
 * Every tick of every job is a model call whether or not there was work to do,
 * and an idle round is the common case — so the only way to know what a
 * schedule costs per day is to see what one round costs. Printed per run
 * rather than totalled, because the processes are per-agent and the interesting
 * comparison is between an idle round and a working one.
 */
function logCost(result: SDKResultMessage): void {
  const { usage: u, num_turns, duration_ms, total_cost_usd } = result;

  console.log(
    `run: in ${u.input_tokens} · cached ${u.cache_read_input_tokens ?? 0}` +
      ` · out ${u.output_tokens} · turns ${num_turns}` +
      ` · ${(duration_ms / 1000).toFixed(1)}s · $${total_cost_usd.toFixed(4)}`,
  );
}

function assertSucceeded(result: SDKResultMessage): void {
  if (result.subtype !== "success") {
    throw new AgentRunError(`Agent run ended: ${result.subtype}`);
  }
}

/**
 * Runs one task to completion and returns everything the agent said.
 *
 * Throws AgentRunError if the run did not finish — callers decide whether that
 * is a 500 or a logged line.
 */
export async function runAgent(prompt: string): Promise<string> {
  const options = agentOptions(await loadSystemPrompt());
  const said: string[] = [];

  for await (const message of query({ prompt, options })) {
    if (message.type === "assistant") said.push(proseOf(message));
    if (message.type === "result") {
      logCost(message);
      assertSucceeded(message);
      return said.join("").trim();
    }
  }

  throw new AgentRunError("Agent run ended without a result.");
}
