/**
 * subscription.ts — on-chain subscription status check via viem.
 * Reads SubscriptionPayment.isSubscribed() on Base.
 */
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { config } from "./config.js";

const SUB_PAYMENT_ABI = [
  {
    name: "isSubscribed",
    type: "function",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "user",    type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "subscriptionExpiry",
    type: "function",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "user",    type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const client = createPublicClient({
  chain: base,
  transport: http(config.rpcUrl),
});

export async function checkOnChainSubscription(
  agentId: number,
  user: Address,
): Promise<boolean> {
  const subAddress = process.env.SUBSCRIPTION_ADDRESS as Address | undefined;
  if (!subAddress) {
    console.warn("[subscription] SUBSCRIPTION_ADDRESS not set, defaulting to open access");
    return true;
  }

  return client.readContract({
    address: subAddress,
    abi: SUB_PAYMENT_ABI,
    functionName: "isSubscribed",
    args: [BigInt(agentId), user],
  });
}

export async function getSubscriptionExpiry(
  agentId: number,
  user: Address,
): Promise<Date | null> {
  const subAddress = process.env.SUBSCRIPTION_ADDRESS as Address | undefined;
  if (!subAddress) return null;

  const expiry = await client.readContract({
    address: subAddress,
    abi: SUB_PAYMENT_ABI,
    functionName: "subscriptionExpiry",
    args: [BigInt(agentId), user],
  });

  return expiry === 0n ? null : new Date(Number(expiry) * 1000);
}
