#!/usr/bin/env node
/**
 * Sends one contract call as a gas-sponsored UserOperation, signed by this
 * agent's own EOA. It replaces `cast send` for every write an agent makes.
 *
 *   node scripts/sponsored-send.mjs <to> <calldata>
 *   node scripts/sponsored-send.mjs --status <callId>
 *
 * Build the calldata with cast, simulate with `cast call` exactly as before,
 * then send:
 *
 *   node scripts/sponsored-send.mjs $USDG \
 *     "$(cast calldata 'transfer(address,uint256)' $TO 4000000)"
 *
 * How it works
 * ------------
 * A paymaster cannot pay for a plain EOA transaction, so the call goes through
 * Alchemy's Wallet API (wallet_prepareCalls / wallet_sendPreparedCalls) as an
 * ERC-4337 UserOperation with our Gas Manager policy attached.
 *
 * The agent keeps its address. `from` is the agent's EOA, which Alchemy
 * upgrades in place with EIP-7702: the EOA is delegated to Alchemy's
 * smart-account code, and the account executes the call itself. So on the
 * target contract `msg.sender` is still the agent's address — the same address
 * its ERC-8004 identity is owned by and its covenants name as `agentWallet`.
 * A separate smart account would have a new address and break both.
 *
 * The delegation is a signed EIP-7702 authorization. It is needed once per
 * address, and Alchemy asks for it inside the first sponsored call; after that
 * prepareCalls returns only the UserOperation to sign.
 *
 * Signing uses `cast wallet sign`, which is already in the image, so this
 * script has no npm dependencies. The private key never leaves the container:
 * Alchemy only ever sees signatures.
 *
 * Environment
 * -----------
 *   PRIVATE_KEY          the signing key (or pass --key-file <path>)
 *   ALCHEMY_API_KEY      the key in https://<network>.g.alchemy.com/v2/<key>
 *   ALCHEMY_POLICY_ID    Gas Manager policy id (a UUID)
 *   RPC_URL              read once for the chain id
 *   KUDO, USDG, IDENTITY_REGISTRY
 *                        the only targets this script will send to, mirroring
 *                        the policy's contract allowlist
 *   SPONSOR_ALLOWLIST    optional extra targets, comma separated
 *   ALCHEMY_WALLET_API_URL  optional override of https://api.g.alchemy.com/v2
 *
 * Output and exit codes
 * ---------------------
 * stdout is one JSON object: status, callId, transactionHash, blockNumber, and
 * the logs this UserOperation emitted. Progress goes to stderr.
 *
 *   0  confirmed — the call executed
 *   1  not sent — nothing reached the chain (bad input, refused by the policy,
 *      rejected before inclusion). Safe to fix and try again.
 *   2  reverted on chain — it landed and did nothing. Read the chain before
 *      trying again.
 *   3  sponsorship is not configured in this environment
 *   4  outcome unknown — sent, but not confirmed before the timeout. It may
 *      still land. NEVER send it again; re-check with --status <callId>.
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

const EXIT = { OK: 0, NOT_SENT: 1, REVERTED: 2, UNCONFIGURED: 3, UNKNOWN: 4 };
const POLL_MS = 1_000;
const TIMEOUT_MS = Number(process.env.SPONSORED_TIMEOUT_SECONDS || 120) * 1_000;

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX = /^0x([0-9a-fA-F]{2})*$/;

class Exit extends Error {
  constructor(code, message, result) {
    super(message);
    this.code = code;
    this.result = result;
  }
}

const say = (message) => process.stderr.write(`sponsored-send: ${message}\n`);

// --- arguments -------------------------------------------------------------

function parseArgs(argv) {
  const args = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--key-file") args.keyFile = argv[++i];
    else if (arg === "--status") args.status = argv[++i];
    else if (arg === "-h" || arg === "--help") args.help = true;
    else if (arg.startsWith("--")) throw new Exit(EXIT.NOT_SENT, `unknown flag ${arg}`);
    else args.positional.push(arg);
  }
  return args;
}

const USAGE = `usage:
  node scripts/sponsored-send.mjs <to> <calldata> [--key-file <path>]
  node scripts/sponsored-send.mjs --status <callId>`;

// --- configuration ---------------------------------------------------------

function sponsorship() {
  const apiKey = process.env.ALCHEMY_API_KEY?.trim();
  const policyId = process.env.ALCHEMY_POLICY_ID?.trim();
  const missing = [
    !apiKey && "ALCHEMY_API_KEY",
    !policyId && "ALCHEMY_POLICY_ID",
  ].filter(Boolean);

  if (missing.length) {
    throw new Exit(
      EXIT.UNCONFIGURED,
      `gas sponsorship is not configured (${missing.join(", ")} unset)`,
    );
  }

  const base = (process.env.ALCHEMY_WALLET_API_URL?.trim() || "https://api.g.alchemy.com/v2")
    .replace(/\/+$/, "");
  return { url: `${base}/${apiKey}`, policyId };
}

/**
 * The contracts an agent may write to. The Gas Manager policy enforces the
 * same list; checking here as well turns a policy refusal into a clear error,
 * and stops a prompt-injected agent before it even asks.
 */
function allowedTargets() {
  const named = ["KUDO", "USDG", "IDENTITY_REGISTRY"]
    .map((name) => process.env[name]?.trim())
    .filter(Boolean);
  const extra = (process.env.SPONSOR_ALLOWLIST || "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  return new Set([...named, ...extra].map((a) => a.toLowerCase()));
}

async function privateKey(keyFile) {
  const key = keyFile
    ? (await readFile(keyFile, "utf8")).trim()
    : process.env.PRIVATE_KEY?.trim();
  if (!key) {
    throw new Exit(EXIT.NOT_SENT, "no signing key: set PRIVATE_KEY or pass --key-file");
  }
  return key.startsWith("0x") ? key : `0x${key}`;
}

// --- JSON-RPC --------------------------------------------------------------

let rpcId = 0;

async function rpc(url, method, params) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
    });
  } catch (error) {
    throw new Error(`${method}: network error: ${error.message}`);
  }

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${method}: HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  if (body.error) {
    const data = body.error.data ? ` ${JSON.stringify(body.error.data)}` : "";
    throw new Error(`${method}: ${body.error.message} (code ${body.error.code})${data}`);
  }
  return body.result;
}

async function chainId() {
  const override = process.env.CHAIN_ID?.trim();
  if (override) return `0x${BigInt(override).toString(16)}`;

  const rpcUrl = process.env.RPC_URL?.trim();
  if (!rpcUrl) throw new Exit(EXIT.NOT_SENT, "RPC_URL is unset — needed for the chain id");
  return rpc(rpcUrl, "eth_chainId", []);
}

// --- signing ---------------------------------------------------------------

async function cast(args) {
  try {
    const { stdout } = await run("cast", args, { maxBuffer: 1 << 20 });
    return stdout.trim();
  } catch (error) {
    // Never echo argv: it contains the private key.
    const detail = (error.stderr || error.message || "").toString().trim().split("\n")[0];
    throw new Error(`cast ${args[0]} ${args[1]} failed: ${detail}`);
  }
}

const addressOf = (key) => cast(["wallet", "address", "--private-key", key]);

/** Signs one entry of a prepareCalls response according to what it asks for. */
async function sign(request, key) {
  if (!request) throw new Error("prepared call carries no signatureRequest");

  switch (request.type) {
    // The EIP-7702 authorization: a raw digest, signed without a prefix.
    case "eth_signAuthorization":
      return cast(["wallet", "sign", "--no-hash", "--private-key", key, request.rawPayload]);

    // The UserOperation hash, signed as an EIP-191 personal message over its
    // raw bytes (cast treats a 0x-prefixed message as bytes, not text).
    case "personal_sign": {
      const raw = typeof request.data === "string" ? request.data : request.data?.raw;
      if (!raw) throw new Error("personal_sign request without data.raw");
      return cast(["wallet", "sign", "--private-key", key, raw]);
    }

    case "eth_signTypedData_v4":
      return cast([
        "wallet", "sign", "--data", "--private-key", key, JSON.stringify(request.data),
      ]);

    default:
      throw new Error(`unsupported signature request type "${request.type}"`);
  }
}

async function signPrepared(prepared, key) {
  if (prepared.type === "array") {
    const data = [];
    for (const item of prepared.data) data.push(await signPrepared(item, key));
    return { type: "array", data };
  }

  if (prepared.type === "eip-7702-authorization") {
    say(`first sponsored call from this address: delegating it with EIP-7702 to ${prepared.data?.address ?? "Alchemy's account"}`);
  }

  const { signatureRequest, ...rest } = prepared;
  const signature = await sign(signatureRequest, key);
  return { ...rest, signature: { type: "secp256k1", data: signature } };
}

/** Every UserOperation in a prepared call must be sent from the agent's own address. */
function assertSender(prepared, from) {
  const items = prepared.type === "array" ? prepared.data : [prepared];
  for (const item of items) {
    const sender = item.data?.sender;
    if (item.type?.startsWith("user-operation") && sender && sender.toLowerCase() !== from.toLowerCase()) {
      throw new Exit(
        EXIT.NOT_SENT,
        `prepared UserOperation is for ${sender}, not ${from} — refusing to sign`,
      );
    }
  }
}

// --- status ----------------------------------------------------------------

/** wallet_getCallsStatus speaks EIP-5792 codes; older responses used strings. */
function classify(status) {
  if (typeof status === "number") {
    if (status >= 100 && status < 200) return "pending";
    if (status >= 200 && status < 300) return "success";
    if (status >= 400 && status < 500) return "failed";
    if (status >= 500 && status < 600) return "reverted"; // 600 = partially reverted
    if (status >= 600) return "reverted";
  }
  const s = String(status).toUpperCase();
  if (s === "PENDING") return "pending";
  if (s === "CONFIRMED" || s === "SUCCESS") return "success";
  return "failed";
}

function summarise(callId, status) {
  const receipts = status.receipts ?? [];
  const receipt = receipts[receipts.length - 1] ?? {};
  return {
    status: classify(status.status),
    statusCode: status.status,
    callId,
    transactionHash: receipt.transactionHash ?? null,
    blockNumber: receipt.blockNumber ? Number(BigInt(receipt.blockNumber)) : null,
    receiptStatus: receipt.status ?? null,
    // Only this UserOperation's logs. The bundle transaction may carry other
    // accounts' operations too, so `cast receipt <hash>` can show logs that
    // are not ours — filter by your own address when reading it that way.
    logs: receipts.flatMap((r) => r.logs ?? []),
  };
}

async function waitFor(url, callId) {
  const deadline = Date.now() + TIMEOUT_MS;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await rpc(url, "wallet_getCallsStatus", [callId]);
      if (classify(last.status) !== "pending") return summarise(callId, last);
    } catch (error) {
      say(`status check failed, retrying: ${error.message}`);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return { ...(last ? summarise(callId, last) : { callId }), status: "unknown" };
}

function finish(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  switch (result.status) {
    case "success":
      say(`confirmed in ${result.transactionHash}`);
      return EXIT.OK;
    case "reverted":
      say(`landed in ${result.transactionHash} but REVERTED — nothing changed. Read the chain before retrying.`);
      return EXIT.REVERTED;
    case "failed":
      say("rejected before inclusion — nothing reached the chain");
      return EXIT.NOT_SENT;
    default:
      say(`not confirmed after ${TIMEOUT_MS / 1000}s. It may still land: do NOT resend. Re-check with --status ${result.callId}`);
      return EXIT.UNKNOWN;
  }
}

// --- main ------------------------------------------------------------------

async function send(to, data, keyFile) {
  if (!ADDRESS.test(to ?? "")) throw new Exit(EXIT.NOT_SENT, `"${to}" is not an address`);
  if (!HEX.test(data ?? "") || data === "0x") {
    throw new Exit(EXIT.NOT_SENT, "calldata must be 0x-prefixed hex — build it with `cast calldata`");
  }

  const allowed = allowedTargets();
  if (!allowed.has(to.toLowerCase())) {
    throw new Exit(
      EXIT.NOT_SENT,
      `${to} is not a sponsored target. Allowed: KUDO, USDG, IDENTITY_REGISTRY` +
        (process.env.SPONSOR_ALLOWLIST ? ", SPONSOR_ALLOWLIST" : ""),
    );
  }

  const { url, policyId } = sponsorship();
  const key = await privateKey(keyFile);
  const from = await addressOf(key);
  const chain = await chainId();

  say(`preparing ${from} -> ${to} on chain ${Number(BigInt(chain))}`);

  let prepared;
  try {
    prepared = await rpc(url, "wallet_prepareCalls", [
      {
        calls: [{ to, data, value: "0x0" }],
        from,
        chainId: chain,
        capabilities: { paymasterService: { policyId } },
      },
    ]);
  } catch (error) {
    // Includes a policy refusal (target not allowlisted, spend cap reached)
    // and a simulated revert. Either way nothing was sent.
    throw new Exit(EXIT.NOT_SENT, error.message);
  }

  assertSender(prepared, from);
  const signed = await signPrepared(prepared, key);

  let sent;
  try {
    sent = await rpc(url, "wallet_sendPreparedCalls", [signed]);
  } catch (error) {
    // A JSON-RPC error is a refusal. A dropped connection is not: the request
    // may have arrived, so the outcome is unknown and the chain must be read
    // before anything is sent again.
    const lost = /network error/.test(error.message);
    throw new Exit(
      lost ? EXIT.UNKNOWN : EXIT.NOT_SENT,
      lost ? `${error.message} — the call may still land; read the chain before resending` : error.message,
      lost ? { status: "unknown" } : undefined,
    );
  }

  const callId = sent?.id ?? sent?.preparedCallIds?.[0] ?? (typeof sent === "string" ? sent : null);
  if (!callId) {
    throw new Exit(EXIT.UNKNOWN, `sent, but no call id came back: ${JSON.stringify(sent)}`, {
      status: "unknown",
    });
  }

  say(`sent, call id ${callId}; waiting for inclusion`);
  return waitFor(url, callId);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return EXIT.OK;
  }

  if (args.status) {
    const { url } = sponsorship();
    return finish(await waitFor(url, args.status));
  }

  if (args.positional.length !== 2) throw new Exit(EXIT.NOT_SENT, USAGE);
  const [to, data] = args.positional;
  return finish(await send(to, data, args.keyFile));
}

main().then(
  (code) => process.exit(code),
  (error) => {
    const code = error instanceof Exit ? error.code : EXIT.NOT_SENT;
    if (error.result) process.stdout.write(`${JSON.stringify(error.result, null, 2)}\n`);
    say(error.message);
    process.exit(code);
  },
);
