"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { ADDRESSES, REGISTRY_ABI } from "@/lib/contracts";
import { AgentCard } from "@/components/AgentCard";

export default function Home() {
  const { data: agentCount } = useReadContract({
    address:      ADDRESSES.registry,
    abi:          REGISTRY_ABI,
    functionName: "agentCount",
  });

  const count = agentCount ? Number(agentCount) : 0;
  const ids   = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <>
      {/* hero */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        padding: "72px 40px 60px",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px",
            borderRadius: 20,
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            fontSize: 12,
            fontWeight: 500,
            marginBottom: 24,
            letterSpacing: "0.02em",
          }}>
            <span style={{
              width: 6, height: 6,
              borderRadius: "50%",
              background: "var(--accent)",
              display: "inline-block",
            }} />
            Live on Base Sepolia
          </div>

          <h1 style={{
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-bright)",
            margin: "0 0 16px",
            lineHeight: 1.1,
            maxWidth: 600,
          }}>
            Agent Bonds.
          </h1>

          <p style={{
            fontSize: 17,
            color: "var(--muted)",
            margin: "0 0 32px",
            maxWidth: 480,
            lineHeight: 1.65,
          }}>
            Tokenized cashflows of AI agents, funded by LPs.
          </p>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/register" style={{
              display: "inline-block",
              padding: "10px 22px",
              borderRadius: 7,
              background: "var(--accent)",
              color: "#fff",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}>
              List your agent
            </Link>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              or scroll down to invest →
            </span>
          </div>
        </div>
      </div>

      {/* marketplace */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 40px 80px" }}>

        {/* section header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 24,
        }}>
          <div>
            <h2 style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--text-bright)",
              margin: "0 0 4px",
              letterSpacing: "-0.02em",
            }}>
              All agents
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              {count} listed · USDC · Base
            </p>
          </div>
        </div>

        {/* grid */}
        {count === 0 ? (
          <EmptyState />
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 12,
          }}>
            {ids.map((id) => <AgentItem key={id} agentId={id} />)}
          </div>
        )}
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <div style={{
      border: "1px dashed var(--border)",
      borderRadius: 12,
      padding: "80px 32px",
      textAlign: "center",
    }}>
      <div style={{
        width: 40, height: 40,
        borderRadius: "50%",
        background: "var(--dark-8)",
        margin: "0 auto 16px",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18,
      }}>
        ∅
      </div>
      <p style={{ margin: "0 0 8px", fontSize: 15, color: "var(--text)", fontWeight: 500 }}>
        No agents listed yet
      </p>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
        Be the first to tokenize your agent&apos;s revenue.
      </p>
      <Link href="/register" style={{
        display: "inline-block",
        padding: "9px 18px",
        borderRadius: 7,
        border: "1px solid var(--accent)",
        color: "var(--accent)",
        textDecoration: "none",
        fontSize: 13,
        fontWeight: 500,
      }}>
        List your agent
      </Link>
    </div>
  );
}

function AgentItem({ agentId }: { agentId: number }) {
  const { data, isLoading } = useReadContract({
    address:      ADDRESSES.registry,
    abi:          REGISTRY_ABI,
    functionName: "getAgent",
    args:         [BigInt(agentId)],
  });

  if (isLoading || !data) {
    return (
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        height: 190,
        background: "var(--surface)",
        opacity: 0.4,
      }} />
    );
  }

  return (
    <AgentCard
      agentId={agentId}
      info={{
        operator:     data.operator,
        owsWallet:    data.owsWallet,
        vault:        data.vault as `0x${string}`,
        name:         data.name,
        endpoint:     data.endpoint,
        description:  data.description,
        revenueTypes: data.revenueTypes,
        registeredAt: data.registeredAt,
      }}
    />
  );
}
