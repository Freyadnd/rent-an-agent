import "dotenv/config";
import { createServer } from "./server.js";
import { config } from "./config.js";

const app = createServer();

app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
  console.log(`[server] Agent ID: ${config.agentId}`);
  console.log(`[server] Registry: ${config.registryAddress ?? "(not configured)"}`);
  console.log(`[server] Vault:    ${config.vaultAddress ?? "(resolving from registry…)"}`);
  console.log(`[server] x402 payTo = vault address (trustless)`);
});
