/**
 * server.ts — Express server exposing:
 *
 *   GET  /health           — 健康检查
 *   GET  /vault/status     — vault 状态（LP 仪表盘用）
 *
 *   ── x402 付费端点 ──
 *   GET  /agent/query      — 按次付费，返回 402 if unpaid
 *   POST /agent/task       — 按次付费任务提交
 *
 *   ── 订阅验证（链上查询）──
 *   GET  /agent/chat       — 需要有效链上订阅
 *
 *   ── 管理 ──
 *   POST /admin/sweep      — 手动触发 sweep（用于测试）
 */

import express, { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { getVaultStatus, sweepToVault, getUsdcBalance, getSweeperWalletClient } from "./vault.js";
import { checkOnChainSubscription } from "./subscription.js";

export function createServer() {
  const app = express();
  app.use(express.json());

  // ── health ──────────────────────────────────────────────────────────────

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
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
  // x402 protocol: server returns 402 with payment details in headers.
  // OWS SDK automatically handles this on the client side.

  app.get("/agent/query", x402Gate(1_000_000), async (req, res) => {
    // Payment verified by x402Gate middleware.
    const question = req.query.q as string ?? "What can you do?";
    res.json({
      answer: `[Agent response to: "${question}"] — This is a stub. Wire your LLM here.`,
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
      reply: `[Agent reply to: "${message}"] — stub. Wire your LLM here.`,
      subscribed: true,
    });
  });

  // ── admin: manual sweep ──────────────────────────────────────────────────

  app.post("/admin/sweep", adminGate(), async (_req, res) => {
    try {
      const { account } = getSweeperWalletClient();
      const balance = await getUsdcBalance(account.address);
      if (balance < 0.01) {
        res.json({ swept: false, reason: "balance too low", balance });
        return;
      }
      const txHash = await sweepToVault(balance, "manual");
      res.json({ swept: true, amount: balance, txHash });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return app;
}

// ─── middleware ──────────────────────────────────────────────────────────────

/**
 * x402Gate — returns 402 with payment info if the request hasn't been paid.
 * OWS client SDK handles this automatically when using `ows pay`.
 *
 * @param priceUsdc6  price in USDC with 6 decimals (e.g. 1_000_000 = 1 USDC)
 */
function x402Gate(priceUsdc6: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const paymentHeader = req.headers["x-payment"];

    if (!paymentHeader) {
      // Return 402 with payment details for OWS SDK to process
      res.status(402).json({
        error: "Payment required",
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: "base-mainnet",
            maxAmountRequired: String(priceUsdc6),
            resource: `${req.protocol}://${req.get("host")}${req.path}`,
            description: `Pay ${priceUsdc6 / 1e6} USDC to access this endpoint`,
            mimeType: "application/json",
            payTo: config.sweeperPrivateKey
              ? getSweeperWalletClient().account.address
              : "0x0000000000000000000000000000000000000000",
            maxTimeoutSeconds: 60,
            asset: config.usdcAddress,
            extra: { name: "USDC", version: "2" },
          },
        ],
      });
      return;
    }

    // TODO: verify payment proof on-chain for production.
    // For hackathon: trust the header, log it.
    console.log(`[x402] Payment header received: ${paymentHeader}`);
    next();
  };
}

/**
 * subscriptionGate — checks on-chain subscription status via AgentRegistry.
 * Requires `x-wallet-address` header from the client.
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

/** adminGate — simple API key check for internal admin endpoints. */
function adminGate() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers["x-api-key"] !== config.agentApiKey) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}
