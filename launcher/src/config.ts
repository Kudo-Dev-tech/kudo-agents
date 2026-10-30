/** Environment, read once at startup so a missing value fails loudly and early. */
import { isAbsolute } from "node:path";

const REQUIRED = [
  "LAUNCHER_TOKEN",
  "DATA_DIR",
  "ANTHROPIC_API_KEY",
  "RPC_URL",
  "KUDO",
  "IDENTITY_REGISTRY",
  "TREASURY_PRIVATE_KEY",
] as const;

const env = (key: string, fallback = "") => process.env[key]?.trim() || fallback;

export function requireEnvironment(): void {
  const missing = REQUIRED.filter((key) => !env(key));
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(", ")}`);
    console.error("See .env.example");
    process.exit(1);
  }
  // Docker resolves -v paths on the host, not in this process, so a relative
  // path would mount whatever happens to be at that path on the host.
  if (!isAbsolute(env("DATA_DIR"))) {
    console.error(`DATA_DIR="${env("DATA_DIR")}" must be an absolute path.`);
    process.exit(1);
  }
}

export const config = {
  get port() {
    return Number(env("PORT", "8080"));
  },
  get token() {
    return env("LAUNCHER_TOKEN");
  },
  get dataDir() {
    return env("DATA_DIR");
  },
  /** Origins the Launch page is served from, e.g. https://kudo.archi. */
  get allowedOrigins() {
    return env("LAUNCHER_ALLOWED_ORIGINS")
      .split(",")
      .map((origin) => origin.trim().replace(/\/+$/, ""))
      .filter(Boolean);
  },

  agent: {
    get image() {
      return env("AGENT_IMAGE", "kudo-agent:local");
    },
    get portBase() {
      return Number(env("AGENT_PORT_BASE", "4100"));
    },
    get memory() {
      return env("AGENT_MEMORY", "768m");
    },
    get cpus() {
      return env("AGENT_CPUS", "0.5");
    },
    get anthropicApiKey() {
      return env("ANTHROPIC_API_KEY");
    },
  },

  chain: {
    get rpcUrl() {
      return env("RPC_URL");
    },
    get explorerUrl() {
      return env("EXPLORER_URL");
    },
    get kudo() {
      return env("KUDO");
    },
    get identityRegistry() {
      return env("IDENTITY_REGISTRY");
    },
    get usdg() {
      return env("USDG");
    },
    get vault() {
      return env("VAULT");
    },
    get adminKey() {
      return env("KUDO_ADMIN_PRIVATE_KEY");
    },
  },

  gas: {
    get treasuryKey() {
      return env("TREASURY_PRIVATE_KEY");
    },
    get initialEth() {
      return env("GAS_INITIAL_ETH", "0.003");
    },
    get refillBelowEth() {
      return env("GAS_REFILL_BELOW_ETH", "0.001");
    },
    get refillEth() {
      return env("GAS_REFILL_ETH", "0.002");
    },
    get dailyCapEth() {
      return env("GAS_DAILY_CAP_ETH", "0.01");
    },
    get checkSeconds() {
      return Math.max(10, Number(env("GAS_CHECK_SECONDS", "60")));
    },
  },
};
