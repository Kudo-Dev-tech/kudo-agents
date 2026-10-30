/**
 * Where agents run: one Docker container each, on this host.
 *
 * Each container runs the same kudo-agent image with its own bundle mounted
 * read-only at /bundle, and is published on 127.0.0.1 only - the launcher is
 * the one way in, so an agent's /message endpoint is never open to the world.
 */
import { execFile } from "node:child_process";
import { request } from "node:http";
import { join } from "node:path";
import { promisify } from "node:util";

import { config } from "./config.ts";
import { agentDir } from "./store.ts";

const run = promisify(execFile);

const containerName = (slug: string) => `kudo-agent-${slug}`;

async function docker(args: string[]): Promise<string> {
  try {
    const { stdout } = await run("docker", args, { timeout: 120_000 });
    return stdout.trim();
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim();
    throw new Error(`docker ${args[0]} failed: ${stderr || (error as Error).message}`);
  }
}

export async function startContainer(slug: string, port: number, envFile: string): Promise<void> {
  // A container left over from a failed launch would block the name.
  await docker(["rm", "-f", containerName(slug)]).catch(() => undefined);

  await docker([
    "run",
    "--detach",
    "--name", containerName(slug),
    "--label", `kudo.agent=${slug}`,
    "--restart", "unless-stopped",
    // Let a run in flight finish rather than killing it between a payment and
    // its attestation. kudo-agent's own grace period is 120s.
    "--stop-timeout", "180",
    "--memory", config.agent.memory,
    "--cpus", config.agent.cpus,
    "--publish", `127.0.0.1:${port}:3000`,
    "--env-file", envFile,
    "--volume", `${join(agentDir(slug), "bundle")}:/bundle:ro`,
    config.agent.image,
  ]);
}

export const stopContainer = (slug: string) => docker(["stop", containerName(slug)]).then(() => undefined);

export const resumeContainer = (slug: string) => docker(["start", containerName(slug)]).then(() => undefined);

/** Docker's own state for the container: running, exited, restarting - or missing. */
export async function containerState(slug: string): Promise<string> {
  return docker(["inspect", "--format", "{{.State.Status}}", containerName(slug)]).catch(() => "missing");
}

export async function containerLogs(slug: string, lines = 200): Promise<string> {
  const { stdout, stderr } = await run("docker", ["logs", "--tail", String(lines), containerName(slug)], {
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024,
  }).catch((error) => ({ stdout: "", stderr: (error as Error).message }));
  return `${stdout}${stderr}`.trim();
}

/**
 * Forwards one message to an agent and waits for its answer.
 *
 * node:http rather than fetch, because a run can take minutes and fetch's
 * header timeout would give up first.
 */
export function messageAgent(port: number, message: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message });
    const req = request(
      {
        host: "127.0.0.1",
        port,
        path: "/message",
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(payload) },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 502, body: Buffer.concat(chunks).toString("utf8") }));
      },
    );
    req.setTimeout(0);
    req.on("error", reject);
    req.end(payload);
  });
}
