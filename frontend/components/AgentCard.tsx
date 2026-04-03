"use client";

import Link from "next/link";
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
  registeredAt: bigint;
}

export function AgentCard({ agentId, info }: { agentId: number; info: AgentInfo }) {
  const { data } = useReadContracts({
    contracts: [
      { address: info.vault, abi: VAULT_ABI, functionName: "status" },
      { address: info.vault, abi: VAULT_ABI, functionName: "fundingGoal" },
    ],
  });

  const status     = data?.[0].result as readonly [bigint, bigint, bigint, bigint, boolean] | undefined;
  const fundingGoal = data?.[1].result as bigint | undefined;

  const deposited   = status ? Number(formatUnits(status[0], 6)) : null;
  const revenue     = status ? Number(formatUnits(status[1], 6)) : null;
  const goal        = fundingGoal ? Number(formatUnits(fundingGoal, 6)) : null;
  const matured     = status?.[4] ?? false;
  const timeLeftSec = status ? Number(status[3]) : null;

  const fillPct = deposited && goal ? Math.min(100, (deposited / goal) * 100) : 0;

  function formatTimeLeft(sec: number) {
    if (sec <= 0) return "Matured";
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
  }

  return (
    <Link href={`/agents/${agentId}`}>
      <div className="border border-gray-800 rounded-xl p-5 hover:border-gray-600 transition-colors bg-gray-900 cursor-pointer">
        {/* header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-white">{info.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{info.description}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ml-3 shrink-0 ${
            matured
              ? "bg-yellow-900 text-yellow-300"
              : "bg-green-900 text-green-300"
          }`}>
            {matured ? "Matured" : "Active"}
          </span>
        </div>

        {/* funding bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{deposited != null ? `$${deposited.toLocaleString()}` : "—"} raised</span>
            <span>{goal != null ? `$${goal.toLocaleString()} goal` : "—"}</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        {/* stats row */}
        <div className="flex gap-4 text-xs text-gray-400">
          <span>
            <span className="text-white font-medium">
              {revenue != null ? `$${revenue.toLocaleString()}` : "—"}
            </span>{" "}
            revenue
          </span>
          <span>
            {timeLeftSec != null ? formatTimeLeft(timeLeftSec) : "—"}
          </span>
        </div>
      </div>
    </Link>
  );
}
