import "dotenv/config";
import { createServer } from "./server.js";
import { startSweeper } from "./sweeper.js";
import { config } from "./config.js";

const app = createServer();

app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
  console.log(`[server] Agent ID: ${config.agentId}`);
  console.log(`[server] Vault:    ${config.vaultAddress ?? "(not configured)"}`);
});

// Start sweeper cron (only if sweeper key is configured)
if (config.sweeperPrivateKey) {
  startSweeper();
} else {
  console.warn("[sweeper] SWEEPER_PRIVATE_KEY not set — sweeper disabled.");
}
