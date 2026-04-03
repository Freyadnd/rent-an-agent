/**
 * sweeper.ts — cron job that watches the agent's OWS wallet and sweeps
 *              USDC revenue into AgentVault on-chain.
 *
 * Flow:
 *   1. Read OWS wallet USDC balance (via viem, since OWS gives us the address)
 *   2. If balance > threshold → call sweepToVault()
 *   3. Log result
 *
 * The sweeper wallet is a separate EOA (not the agent's OWS wallet).
 * It holds the USDC that was collected from agent earnings, then calls
 * receiveRevenue() on the vault. The OWS wallet periodically sends its
 * balance to the sweeper EOA via OWS CLI / SDK.
 */

import cron from "node-cron";
import { config } from "./config.js";
import { getUsdcBalance, sweepToVault, getSweeperWalletClient } from "./vault.js";

let isRunning = false;

async function runSweep(): Promise<void> {
  if (isRunning) {
    console.log("[sweeper] Previous sweep still running, skipping.");
    return;
  }
  isRunning = true;

  try {
    const { account } = getSweeperWalletClient();
    const balance = await getUsdcBalance(account.address);

    console.log(`[sweeper] Sweeper wallet USDC balance: ${balance.toFixed(6)}`);

    if (balance < config.sweepThresholdUsdc) {
      console.log(`[sweeper] Below threshold (${config.sweepThresholdUsdc} USDC), skipping.`);
      return;
    }

    console.log(`[sweeper] Sweeping ${balance.toFixed(6)} USDC → vault...`);
    const txHash = await sweepToVault(balance, "x402+tx_fee");
    console.log(`[sweeper] Swept. tx: ${txHash}`);
  } catch (err) {
    console.error("[sweeper] Error:", err);
  } finally {
    isRunning = false;
  }
}

export function startSweeper(): void {
  const intervalMinutes = config.sweepIntervalMinutes;
  const cronExpr = `*/${intervalMinutes} * * * *`;

  console.log(`[sweeper] Starting. Interval: every ${intervalMinutes} min. Threshold: ${config.sweepThresholdUsdc} USDC.`);

  // Run once immediately on startup
  runSweep();

  cron.schedule(cronExpr, () => {
    console.log(`[sweeper] Cron tick at ${new Date().toISOString()}`);
    runSweep();
  });
}
