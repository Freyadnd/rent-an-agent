"use client";

import { useReadContract } from "wagmi";
import { ADDRESSES, REGISTRY_ABI } from "@/lib/contracts";
import { AgentCard } from "@/components/AgentCard";

export default function Home() {
  const { data: agentCount } = useReadContract({
    address: ADDRESSES.registry,
    abi:     REGISTRY_ABI,
    functionName: "agentCount",
  });

  const count = agentCount ? Number(agentCount) : 0;
  const ids = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* hero */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-white mb-3">Agent Marketplace</h1>
        <p className="text-gray-400 text-lg max-w-xl">
          Fund AI agents, earn yield from their revenue. Fixed-term, on-chain, transparent.
        </p>
      </div>

      {/* stats bar */}
      <div className="flex gap-8 mb-10 text-sm">
        <div>
          <div className="text-2xl font-bold text-white">{count}</div>
          <div className="text-gray-500">Agents listed</div>
        </div>
        <div className="w-px bg-gray-800" />
        <div>
          <div className="text-2xl font-bold text-white">Base</div>
          <div className="text-gray-500">Network</div>
        </div>
        <div className="w-px bg-gray-800" />
        <div>
          <div className="text-2xl font-bold text-white">USDC</div>
          <div className="text-gray-500">Denomination</div>
        </div>
      </div>

      {/* agent grid */}
      {count === 0 ? (
        <div className="border border-dashed border-gray-800 rounded-xl p-16 text-center">
          <p className="text-gray-500 mb-4">No agents listed yet.</p>
          <a href="/register" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            List your agent →
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ids.map((id) => (
            <AgentItem key={id} agentId={id} />
          ))}
        </div>
      )}
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
    return <div className="border border-gray-800 rounded-xl p-5 animate-pulse bg-gray-900 h-36" />;
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
        registeredAt: data.registeredAt,
      }}
    />
  );
}
