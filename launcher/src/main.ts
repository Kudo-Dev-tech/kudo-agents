/**
 * Entry point: the launcher's API and UI, and the gas tank that keeps every
 * launched agent's wallet topped up.
 *
 * Agents run as containers beside this process (runtime.ts), so stopping the
 * launcher stops neither them nor their own schedules - only launches and
 * refills. Restarting it picks both back up from DATA_DIR.
 */
import { config, requireEnvironment } from "./config.ts";
import { startGasTank, treasuryStatus } from "./gas-tank.ts";
import { startServer } from "./server.ts";

async function main(): Promise<void> {
  requireEnvironment();

  const treasury = await treasuryStatus();
  console.log(`treasury ${treasury.address}: ${treasury.balanceEth} ETH`);
  if (treasury.low) {
    console.error(
      `Warning: the treasury cannot cover one more launch (${config.gas.initialEth} ETH) ` +
        `and one refill (${config.gas.refillEth} ETH). Fund it before launching agents.`,
    );
  }

  const server = startServer();
  const tank = startGasTank();

  const shutdown = () => {
    console.log("shutting down");
    server.close();
    tank.stop();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

await main();
