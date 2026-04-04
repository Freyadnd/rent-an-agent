/**
 * server.ts — Express server exposing:
 *
 *   GET  /health           — health check
 *   GET  /vault/status     — vault status (LP dashboard)
 *
 *   ── x402 pay-per-use ──
 *   GET  /agent/query      — pay-per-use, returns 402 with payTo = vault address
 *   POST /agent/task       — pay-per-use task submission
 *
 *   ── subscription (on-chain check) ──
 *   POST /agent/chat       — requires valid on-chain subscription
 *
 * Revenue architecture:
 *   x402 payTo = vault address (read from AgentRegistry on startup).
 *   Payments land directly in vault — no sweeper, no intermediary.
 */

import express, { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { getVaultStatus, publicClient } from "./vault.js";
import { checkOnChainSubscription } from "./subscription.js";

// ─── read vault address from registry at startup ──────────────────────────────

const REGISTRY_ABI = [
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
          { name: "revenueTypes", type: "uint8"   },
          { name: "registeredAt", type: "uint256" },
          { name: "bondAmount",   type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

let vaultAddress: `0x${string}` = config.vaultAddress ?? "0x0000000000000000000000000000000000000000";

async function resolveVaultAddress() {
  if (config.vaultAddress) {
    vaultAddress = config.vaultAddress;
    console.log(`[server] Vault address (from env): ${vaultAddress}`);
    return;
  }
  if (!config.registryAddress || !config.agentId) return;

  try {
    const agent = await publicClient.readContract({
      address: config.registryAddress,
      abi: REGISTRY_ABI,
      functionName: "getAgent",
      args: [BigInt(config.agentId)],
    });
    vaultAddress = agent.vault as `0x${string}`;
    console.log(`[server] Vault address (from registry): ${vaultAddress}`);
  } catch (err) {
    console.warn("[server] Could not resolve vault address from registry:", err);
  }
}

// Resolve on startup (non-blocking)
resolveVaultAddress();

// ─── server ──────────────────────────────────────────────────────────────────

export function createServer() {
  const app = express();
  app.use(express.json());

  // ── health ──────────────────────────────────────────────────────────────

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now(), vault: vaultAddress });
  });

  // ── vault status ─────────────────────────────────────────────────────────

  app.get("/vault/status", async (_req, res) => {
    try {
      const status = await getVaultStatus();
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── x402: pay-per-use query ──────────────────────────────────────────────
  //
  // payTo = vault address (read from registry). Revenue lands directly in vault.

  app.get("/agent/query", x402Gate(1_000_000), async (req, res) => {
    const question = req.query.q as string ?? "What can you do?";
    res.json({
      answer: `[Agent response to: "${question}"] — Wire your LLM here.`,
      paid: true,
    });
  });

  app.post("/agent/task", x402Gate(2_000_000), async (req, res) => {
    const { task } = req.body as { task: string };
    res.json({
      result: `[Agent completed task: "${task}"] — stub response.`,
      paid: true,
    });
  });

  // ── subscription: chat endpoint ──────────────────────────────────────────

  app.post("/agent/chat", subscriptionGate(), async (req, res) => {
    const { message } = req.body as { message: string };
    res.json({
      reply: `[Agent reply to: "${message}"] — Wire your LLM here.`,
      subscribed: true,
    });
  });

  return app;
}

// ─── middleware ──────────────────────────────────────────────────────────────

/**
 * x402Gate — returns 402 with payment info pointing directly to vault.
 * payTo = vault address (on-chain verifiable, trustless).
 */
function x402Gate(priceUsdc6: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers["x-payment"];

    if (!paymentHeader) {
      res.status(402).json({
        error: "Payment required",
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: "base-sepolia",
            maxAmountRequired: String(priceUsdc6),
            resource: `${req.protocol}://${req.get("host")}${req.path}`,
            description: `Pay ${priceUsdc6 / 1e6} USDC to access this endpoint`,
            mimeType: "application/json",
            payTo: vaultAddress,   // ← vault address, trustless
            maxTimeoutSeconds: 60,
            asset: config.usdcAddress,
            extra: { name: "USDC", version: "2" },
          },
        ],
      });
      return;
    }

    // TODO: verify payment proof on-chain for production.
    console.log(`[x402] Payment header received: ${paymentHeader}`);
    next();
  };
}

/**
 * subscriptionGate — checks on-chain subscription status via AgentRegistry.
 */
function subscriptionGate() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const walletAddress = req.headers["x-wallet-address"] as string;
    if (!walletAddress) {
      res.status(401).json({ error: "Missing x-wallet-address header" });
      return;
    }

    try {
      const active = await checkOnChainSubscription(
        config.agentId,
        walletAddress as `0x${string}`,
      );
      if (!active) {
        res.status(403).json({ error: "No active subscription. Purchase one on-chain." });
        return;
      }
      next();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}
