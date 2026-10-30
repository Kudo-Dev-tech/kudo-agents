/**
 * The launcher's HTTP API, and the UI in public/.
 *
 *   GET  /api/config                    network, gas sponsorship terms, treasury
 *   GET  /api/agents                    every agent, with live state and balance
 *   POST /api/agents                    launch one (see bundle.ts for the body)
 *   POST /api/agents/:slug/retry        resume a failed launch
 *   POST /api/agents/:slug/stop|start   stop or resume its container
 *   GET  /api/agents/:slug/logs         its container's recent output
 *   POST /api/agents/:slug/message      {"message": "..."} -> the agent's answer
 *
 * Every /api route needs `Authorization: Bearer <LAUNCHER_TOKEN>`. The static
 * UI does not - it holds nothing until the token is entered.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { BUILT_IN_TASKS, type LaunchRequest } from "./bundle.ts";
import { balanceOf, hasAgentRole, weiToEth } from "./chain.ts";
import { config } from "./config.ts";
import { sentToday, treasuryStatus } from "./gas-tank.ts";
import { InvalidBundle, launch, retry } from "./launch.ts";
import { containerLogs, containerState, messageAgent, resumeContainer, stopContainer } from "./runtime.ts";
import { getAgent, listAgents, updateAgent, type AgentRecord } from "./store.ts";

const PUBLIC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");
const MAX_BODY_BYTES = 1024 * 1024;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  response.end(payload);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new InvalidBundle("Request body too large.");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InvalidBundle("Body is not valid JSON.");
  }
}

function authorised(request: IncomingMessage): boolean {
  const given = Buffer.from(request.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(config.token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** A record plus what is true right now: the container's state, the wallet's ETH, the role. */
async function live(agent: AgentRecord) {
  const [state, balance, role, sent] = await Promise.all([
    containerState(agent.slug),
    balanceOf(agent.address).then(weiToEth).catch(() => null),
    hasAgentRole(agent.address).catch(() => null),
    sentToday(agent.slug),
  ]);
  return {
    ...agent,
    container: state,
    balanceEth: balance,
    hasAgentRole: role,
    gasSentTodayEth: weiToEth(sent),
  };
}

async function api(request: IncomingMessage, response: ServerResponse, path: string): Promise<void> {
  const method = request.method ?? "GET";

  if (method === "GET" && path === "/api/config") {
    return sendJson(response, 200, {
      network: { rpcUrl: config.chain.rpcUrl, explorerUrl: config.chain.explorerUrl, kudo: config.chain.kudo },
      gas: {
        sponsored: true,
        initialEth: config.gas.initialEth,
        refillBelowEth: config.gas.refillBelowEth,
        refillEth: config.gas.refillEth,
        dailyCapEth: config.gas.dailyCapEth,
        treasury: await treasuryStatus().catch(() => null),
      },
      grantsAgentRole: Boolean(config.chain.adminKey),
      builtInTasks: BUILT_IN_TASKS,
    });
  }

  if (method === "GET" && path === "/api/agents") {
    return sendJson(response, 200, { agents: await Promise.all((await listAgents()).map(live)) });
  }

  if (method === "POST" && path === "/api/agents") {
    const record = await launch((await readJson(request)) as LaunchRequest);
    return sendJson(response, 202, { agent: record });
  }

  const match = /^\/api\/agents\/([a-z0-9-]+)\/(retry|stop|start|logs|message)$/.exec(path);
  if (!match) return sendJson(response, 404, { error: "Not found." });

  const [, slug, action] = match;
  const agent = await getAgent(slug);
  if (!agent) return sendJson(response, 404, { error: `No agent "${slug}".` });

  if (method === "POST" && action === "retry") {
    return sendJson(response, 202, { agent: await retry(slug) });
  }
  if (method === "POST" && action === "stop") {
    await stopContainer(slug);
    return sendJson(response, 200, { agent: await updateAgent(slug, { stage: "stopped" }) });
  }
  if (method === "POST" && action === "start") {
    if (agent.stage !== "stopped") throw new InvalidBundle(`${slug} is ${agent.stage}, not stopped.`);
    await resumeContainer(slug);
    return sendJson(response, 200, { agent: await updateAgent(slug, { stage: "running" }) });
  }
  if (method === "GET" && action === "logs") {
    return sendJson(response, 200, { logs: await containerLogs(slug) });
  }
  if (method === "POST" && action === "message") {
    if (agent.stage !== "running") throw new InvalidBundle(`${slug} is ${agent.stage}, not running.`);
    const text = ((await readJson(request)) as { message?: unknown })?.message;
    if (typeof text !== "string" || !text.trim()) throw new InvalidBundle('Body must be {"message": "<text>"}.');

    // A run can take minutes.
    request.setTimeout(0);
    response.setTimeout(0);
    const answer = await messageAgent(agent.port, text);
    response.writeHead(answer.status, { "Content-Type": "application/json" });
    return void response.end(answer.body);
  }

  return sendJson(response, 405, { error: `${method} not allowed here.` });
}

async function serveStatic(response: ServerResponse, path: string): Promise<void> {
  const file = resolve(PUBLIC_DIR, `.${path === "/" ? "/index.html" : path}`);
  if (!file.startsWith(PUBLIC_DIR)) return sendJson(response, 404, { error: "Not found." });
  try {
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    sendJson(response, 404, { error: "Not found." });
  }
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const path = new URL(request.url ?? "/", "http://launcher").pathname;

  if (!path.startsWith("/api/")) return serveStatic(response, path);
  if (!authorised(request)) return sendJson(response, 401, { error: "Missing or wrong launcher token." });

  try {
    await api(request, response, path);
  } catch (error) {
    // A bad submission is the caller's (400); anything else is ours (500).
    const status = error instanceof InvalidBundle ? 400 : 500;
    if (status === 500) console.error(error);
    if (!response.headersSent) sendJson(response, status, { error: (error as Error).message });
  }
}

export function startServer(): { close(): void } {
  const server = createServer((request, response) => void route(request, response));
  server.listen(config.port, () => console.log(`launcher on :${config.port}`));
  return { close: () => server.close() };
}
