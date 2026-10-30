/**
 * Everything the launcher does on chain, through `cast` - the same toolchain
 * the agents use, so there is one way of talking to the chain in this repo
 * rather than cast in the agents and a JS library here.
 *
 * Keys go to cast as arguments of a child process, never through a shell, and
 * never appear in anything this module logs or throws.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { config } from "./config.ts";

const run = promisify(execFile);

/** keccak256("AGENT_ROLE") - the role mintCovenant checks for. */
export const AGENT_ROLE = "0xcab5a0bfe0b79d2c4b1c2e02599fa044d115b7511f9659307cb4276950967709";

/** topic0 of Registered(uint256 indexed agentId, string agentURI, address indexed owner). */
const REGISTERED = "0xca52e62c367d81bb2e328eb795f7c7ba24afb478408a26c0e201d155c449bc4a";

const WEI_PER_ETH = 10n ** 18n;

/** Runs cast and returns stdout, with any key scrubbed from the error. */
async function cast(args: string[], secrets: string[] = []): Promise<string> {
  try {
    const { stdout } = await run("cast", args, { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
    return stdout.trim();
  } catch (error) {
    let message = (error as { stderr?: string }).stderr?.trim() || (error as Error).message;
    for (const secret of secrets) message = message.replaceAll(secret, "<key>");
    throw new Error(`cast ${args[0]} failed: ${message}`);
  }
}

const rpc = () => ["--rpc-url", config.chain.rpcUrl];

export function ethToWei(eth: string): bigint {
  const [whole, fraction = ""] = eth.split(".");
  return BigInt(whole || "0") * WEI_PER_ETH + BigInt(fraction.padEnd(18, "0").slice(0, 18) || "0");
}

export function weiToEth(wei: bigint): string {
  const whole = wei / WEI_PER_ETH;
  const fraction = (wei % WEI_PER_ETH).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export interface Wallet {
  address: string;
  privateKey: string;
}

export async function newWallet(): Promise<Wallet> {
  const [wallet] = JSON.parse(await cast(["wallet", "new", "--json"])) as Array<{
    address: string;
    private_key: string;
  }>;
  return { address: wallet.address, privateKey: wallet.private_key };
}

export async function addressOf(privateKey: string): Promise<string> {
  return cast(["wallet", "address", "--private-key", privateKey], [privateKey]);
}

export async function balanceOf(address: string): Promise<bigint> {
  return BigInt(await cast(["balance", address, ...rpc()]));
}

interface Receipt {
  transactionHash: string;
  status: string;
  logs: Array<{ topics: string[] }>;
}

/** Sends a transaction, waits for its receipt, and fails if it reverted. */
async function send(privateKey: string, args: string[]): Promise<Receipt> {
  const receipt = JSON.parse(
    await cast(["send", ...args, "--private-key", privateKey, ...rpc(), "--json"], [privateKey]),
  ) as Receipt;

  if (receipt.status !== "0x1" && receipt.status !== "1") {
    throw new Error(`transaction ${receipt.transactionHash} reverted`);
  }
  return receipt;
}

/** Plain ETH transfer. Returns the transaction hash. */
export async function sendEth(fromKey: string, to: string, wei: bigint): Promise<string> {
  const receipt = await send(fromKey, [to, "--value", wei.toString()]);
  return receipt.transactionHash;
}

/**
 * Registers an ERC-8004 identity owned by the agent's own wallet, and reads the
 * new id out of the receipt.
 *
 * The agent's key signs, not the launcher's: the registry makes the sender the
 * owner, and Kudo attributes covenants to whoever owns the identity. Only the
 * name is registered - there is no TEE, so there is no teeId to vouch for.
 */
export async function registerIdentity(agentKey: string, name: string): Promise<string> {
  const nameHex = `0x${Buffer.from(name, "utf8").toString("hex")}`;
  const receipt = await send(agentKey, [
    config.chain.identityRegistry,
    "register(string,(string,bytes)[])",
    "",
    `[(name,${nameHex})]`,
  ]);

  const log = receipt.logs.find((entry) => entry.topics[0]?.toLowerCase() === REGISTERED);
  if (!log?.topics[1]) {
    throw new Error(`no Registered event in ${receipt.transactionHash}`);
  }
  return BigInt(log.topics[1]).toString();
}

/** How many identities this wallet owns, so a retried launch never registers twice. */
export async function identityCount(address: string): Promise<bigint> {
  const out = await cast([
    "call",
    config.chain.identityRegistry,
    "balanceOf(address)(uint256)",
    address,
    ...rpc(),
  ]);
  return BigInt(out.split(" ")[0]);
}

export async function hasAgentRole(address: string): Promise<boolean> {
  const out = await cast([
    "call",
    config.chain.kudo,
    "hasRole(bytes32,address)(bool)",
    AGENT_ROLE,
    address,
    ...rpc(),
  ]);
  return out === "true";
}

export async function grantAgentRole(adminKey: string, address: string): Promise<string> {
  const receipt = await send(adminKey, [
    config.chain.kudo,
    "grantRole(bytes32,address)",
    AGENT_ROLE,
    address,
  ]);
  return receipt.transactionHash;
}
