/**
 * vault.ts — viem client for interacting with AgentVault + USDC on Base.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { config } from "./config.js";

// ─── ABI fragments ───────────────────────────────────────────────────────────

const VAULT_ABI = [
  {
    name: "receiveRevenue",
    type: "function",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "source", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "totalRevenue",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "totalDeposited",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
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

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// ─── clients ─────────────────────────────────────────────────────────────────

export const publicClient = createPublicClient({
  chain: base,
  transport: http(config.rpcUrl),
});

export function getSweeperWalletClient() {
  if (!config.sweeperPrivateKey) throw new Error("SWEEPER_PRIVATE_KEY not set");
  const account = privateKeyToAccount(config.sweeperPrivateKey);
  return {
    client: createWalletClient({ account, chain: base, transport: http(config.rpcUrl) }),
    account,
  };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** USDC balance of an address, in human units (e.g. "12.50"). */
export async function getUsdcBalance(address: Address): Promise<number> {
  const raw = await publicClient.readContract({
    address: config.usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  return Number(formatUnits(raw, 6));
}

/** Send revenue from sweeper wallet → vault. */
export async function sweepToVault(amountUsdc: number, source: string): Promise<string> {
  const vault = config.vaultAddress;
  if (!vault) throw new Error("VAULT_ADDRESS not configured");

  const { client, account } = getSweeperWalletClient();
  const amount = parseUnits(amountUsdc.toFixed(6), 6);

  // 1. approve vault to spend sweeper's USDC
  const approveTx = await client.writeContract({
    address: config.usdcAddress,
    abi: ERC20_ABI,
    functionName: "approve",
    args: [vault, amount],
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: approveTx });

  // 2. call receiveRevenue
  const revenueTx = await client.writeContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "receiveRevenue",
    args: [amount, source],
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: revenueTx });

  return revenueTx;
}

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
    deposited:  Number(formatUnits(deposited, 6)),
    revenue:    Number(formatUnits(revenue,   6)),
    shares:     Number(formatUnits(shares,    6)),
    timeLeftSec: Number(timeLeft),
    matured,
  };
}
