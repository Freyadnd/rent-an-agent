import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

export const config = {
  // EVM (Base / Base Sepolia)
  rpcUrl:           process.env.RPC_URL ?? "https://mainnet.base.org",
  chainId:          Number(process.env.CHAIN_ID ?? 8453),

  // Contract addresses (populated after deploy)
  registryAddress:  process.env.REGISTRY_ADDRESS as `0x${string}` | undefined,
  vaultAddress:     process.env.VAULT_ADDRESS     as `0x${string}` | undefined,
  usdcAddress:      (process.env.USDC_ADDRESS ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`,

  // Agent identity
  agentId: Number(process.env.AGENT_ID ?? 0),

  // x402 server
  port: Number(process.env.PORT ?? 3001),

  // Agent API key (for protected endpoints)
  agentApiKey: process.env.AGENT_API_KEY ?? "dev-key",
};
