/**
 * vault.ts — viem client for reading AgentVault status on Base.
 */
import {
  createPublicClient,
  http,
  formatUnits,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { config } from "./config.js";

// ─── ABI fragments ───────────────────────────────────────────────────────────

const VAULT_ABI = [
  {
    name: "status",
    type: "function",
    inputs: [],
    outputs: [
      { name: "deposited", type: "uint256" },
      { name: "revenue",   type: "uint256" },
      { name: "shares_",   type: "uint256" },
      { name: "timeLeft",  type: "uint256" },
      { name: "matured",   type: "bool"    },
    ],
    stateMutability: "view",
  },
] as const;

// ─── client ──────────────────────────────────────────────────────────────────

const chain = config.chainId === 84532 ? baseSepolia : base;

export const publicClient = createPublicClient({
  chain,
  transport: http(config.rpcUrl),
});

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Read vault status. */
export async function getVaultStatus() {
  const vault = config.vaultAddress;
  if (!vault) throw new Error("VAULT_ADDRESS not configured");

  const [deposited, revenue, shares, timeLeft, matured] =
    await publicClient.readContract({
      address: vault,
      abi: VAULT_ABI,
      functionName: "status",
    });

  return {
    deposited:   Number(formatUnits(deposited, 6)),
    revenue:     Number(formatUnits(revenue,   6)),
    shares:      Number(formatUnits(shares,    6)),
    timeLeftSec: Number(timeLeft),
    matured,
  };
}
