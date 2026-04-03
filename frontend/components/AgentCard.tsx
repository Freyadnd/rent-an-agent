"use client";

import Link from "next/link";
import { useState } from "react";
import { useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { VAULT_ABI } from "@/lib/contracts";

interface AgentInfo {
  operator:     string;
  owsWallet:    string;
  vault:        `0x${string}`;
  name:         string;
  endpoint:     string;
  description:  string;
  revenueTypes: number;
  registeredAt: bigint;
}

const REVENUE_LABELS = [
  { bit: 0x01, label: "x402"         },
  { bit: 0x02, label: "Subscription" },
  { bit: 0x04, label: "Trading"      },
];

function fmtTimeLeft(sec: number) {
  if (sec <= 0) return null;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d}d` : `${h}h`;
}

export function AgentCard({ agentId, info }: { agentId: number; info: AgentInfo }) {
  const [hovered, setHovered] = useState(false);

  const { data } = useReadContracts({
    contracts: [
      { address: info.vault, abi: VAULT_ABI, functionName: "status"      },
      { address: info.vault, abi: VAULT_ABI, functionName: "fundingGoal" },
    ],
  });

  const status      = data?.[0].result as readonly [bigint, bigint, bigint, bigint, boolean] | undefined;
  const fundingGoal = data?.[1].result as bigint | undefined;

  const deposited   = status ? Number(formatUnits(status[0], 6)) : null;
  const revenue     = status ? Number(formatUnits(status[1], 6)) : null;
  const goal        = fundingGoal ? Number(formatUnits(fundingGoal, 6)) : null;
  const matured     = status?.[4] ?? false;
  const timeLeftSec = status ? Number(status[3]) : null;
  const fillPct     = deposited && goal ? Math.min(100, (deposited / goal) * 100) : 0;
  const timeStr     = timeLeftSec ? fmtTimeLeft(timeLeftSec) : null;

  const revenueLabels = REVENUE_LABELS.filter(({ bit }) => (info.revenueTypes & bit) !== 0);

  return (
    <Link href={`/agents/${agentId}`} style={{ textDecoration: "none", display: "block" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          border:       `1px solid ${hovered ? "var(--dark-3)" : "var(--border)"}`,
          borderRadius: 10,
          padding:      "20px 22px 18px",
          background:   hovered ? "var(--surface-alt)" : "var(--surface)",
          cursor:       "pointer",
          transition:   "border-color 0.15s, background 0.15s",
          display:      "flex",
          flexDirection:"column",
          gap:          14,
          height:       "100%",
        }}
      >
        {/* header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-bright)",
              letterSpacing: "-0.01em",
              marginBottom: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {info.name}
            </div>
            <div style={{
              fontSize: 12,
              color: "var(--muted)",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {info.description || info.endpoint}
            </div>
          </div>

          <div style={{
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 20,
            border: `1px solid ${matured ? "var(--border)" : "var(--accent)"}`,
            color: matured ? "var(--muted)" : "var(--accent)",
            whiteSpace: "nowrap",
            flexShrink: 0,
            fontWeight: 500,
          }}>
            {matured ? "matured" : "active"}
          </div>
        </div>

        {/* funding bar */}
        <div>
          <div style={{
            height: 3,
            background: "var(--dark-8)",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${fillPct}%`,
              background: matured ? "var(--border)" : "var(--accent)",
              borderRadius: 2,
              transition: "width 0.4s ease",
            }} />
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 11,
            color: "var(--muted)",
          }}>
            <span style={{ color: deposited ? "var(--text)" : "var(--muted)" }}>
              {deposited != null ? `$${deposited.toLocaleString()}` : "—"} raised
            </span>
            <span>{goal != null ? `goal $${goal.toLocaleString()}` : "—"}</span>
          </div>
        </div>

        {/* footer */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
          paddingTop: 4,
          borderTop: "1px solid var(--dark-8)",
        }}>
          <div style={{ display: "flex", gap: 5 }}>
            {revenueLabels.map(({ label }) => (
              <span key={label} style={{
                fontSize: 10,
                padding: "2px 7px",
                borderRadius: 4,
                background: "var(--dark-8)",
                color: "var(--muted)",
                fontFamily: "var(--mono)",
                letterSpacing: "0.02em",
              }}>
                {label}
              </span>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 10 }}>
            {revenue != null && revenue > 0 && (
              <span style={{ color: "var(--text)" }}>${revenue.toLocaleString()} rev</span>
            )}
            {timeStr && !matured && <span>{timeStr} left</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
