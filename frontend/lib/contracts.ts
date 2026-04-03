import { base } from "wagmi/chains";

// ─── Addresses ───────────────────────────────────────────────────────────────
// Fill in after `forge script Deploy`

export const ADDRESSES = {
  registry:     (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS     ?? "0x") as `0x${string}`,
  subscription: (process.env.NEXT_PUBLIC_SUBSCRIPTION_ADDRESS ?? "0x") as `0x${string}`,
  usdc:         (process.env.NEXT_PUBLIC_USDC_ADDRESS         ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913") as `0x${string}`,
} as const;

export const CHAIN = base;

// ─── ABIs ────────────────────────────────────────────────────────────────────

export const REGISTRY_ABI = [
  {
    name: "agentCount",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "getAgent",
    type: "function",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "operator",     type: "address" },
          { name: "owsWallet",    type: "address" },
          { name: "vault",        type: "address" },
          { name: "name",         type: "string"  },
          { name: "endpoint",     type: "string"  },
          { name: "description",  type: "string"  },
          { name: "registeredAt", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    name: "registerAgent",
    type: "function",
    inputs: [
      { name: "owsWallet",   type: "address" },
      { name: "name",        type: "string"  },
      { name: "endpoint",    type: "string"  },
      { name: "description", type: "string"  },
      { name: "maturity",    type: "uint256" },
      { name: "fundingGoal", type: "uint256" },
      { name: "sweeper",     type: "address" },
    ],
    outputs: [
      { name: "agentId", type: "uint256" },
      { name: "vault",   type: "address" },
    ],
    stateMutability: "nonpayable",
  },
] as const;

export const VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "redeem",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "previewRedeem",
    type: "function",
    inputs: [{ name: "lp", type: "address" }],
    outputs: [{ name: "payout", type: "uint256" }],
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
  {
    name: "shares",
    type: "function",
    inputs: [{ name: "lp", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "redeemed",
    type: "function",
    inputs: [{ name: "lp", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "fundingGoal",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "maturity",
    type: "function",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
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
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;
