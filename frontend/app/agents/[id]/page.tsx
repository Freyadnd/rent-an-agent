"use client";

import { use } from "react";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { useState } from "react";
import { ADDRESSES, REGISTRY_ABI, VAULT_ABI, ERC20_ABI } from "@/lib/contracts";

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const agentId = BigInt(id);

  const { address } = useAccount();

  const { data: agentInfo, isLoading: agentLoading } = useReadContract({
    address:      ADDRESSES.registry,
    abi:          REGISTRY_ABI,
    functionName: "getAgent",
    args:         [agentId],
  });

  const vaultAddress = agentInfo?.vault as `0x${string}` | undefined;

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: VAULT_ABI, functionName: "status" },
      { address: vaultAddress, abi: VAULT_ABI, functionName: "fundingGoal" },
      { address: vaultAddress, abi: VAULT_ABI, functionName: "maturity" },
      ...(address ? [
        { address: vaultAddress, abi: VAULT_ABI, functionName: "shares",        args: [address] },
        { address: vaultAddress, abi: VAULT_ABI, functionName: "redeemed",      args: [address] },
        { address: vaultAddress, abi: VAULT_ABI, functionName: "previewRedeem", args: [address] },
        { address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "allowance",   args: [address, vaultAddress!] },
        { address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "balanceOf",   args: [address] },
      ] : []),
    ],
    query: { enabled: !!vaultAddress },
  });

  const status      = data?.[0].result as readonly [bigint, bigint, bigint, bigint, boolean] | undefined;
  const fundingGoal = data?.[1].result as bigint | undefined;
  const maturity    = data?.[2].result as bigint | undefined;
  const lpShares    = data?.[3]?.result as bigint | undefined;
  const hasRedeemed = data?.[4]?.result as boolean | undefined;
  const preview     = data?.[5]?.result as bigint | undefined;
  const allowance   = data?.[6]?.result as bigint | undefined;
  const usdcBalance = data?.[7]?.result as bigint | undefined;

  const deposited   = status ? Number(formatUnits(status[0], 6)) : 0;
  const revenue     = status ? Number(formatUnits(status[1], 6)) : 0;
  const timeLeftSec = status ? Number(status[3]) : 0;
  const matured     = status?.[4] ?? false;
  const goal        = fundingGoal ? Number(formatUnits(fundingGoal, 6)) : 0;
  const fillPct     = goal ? Math.min(100, (deposited / goal) * 100) : 0;
  const maturityDate = maturity ? new Date(Number(maturity) * 1000) : null;

  const myShares  = lpShares  ? Number(formatUnits(lpShares,  6)) : 0;
  const myPayout  = preview   ? Number(formatUnits(preview,   6)) : 0;
  const myBalance = usdcBalance ? Number(formatUnits(usdcBalance, 6)) : 0;

  if (agentLoading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-800 rounded w-1/2" />
          <div className="h-4 bg-gray-800 rounded w-3/4" />
          <div className="h-48 bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!agentInfo) return <div className="p-12 text-gray-500">Agent not found.</div>;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-6">
      {/* header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-white">{agentInfo.name}</h1>
          <span className={`text-xs px-2 py-1 rounded-full ${matured ? "bg-yellow-900 text-yellow-300" : "bg-green-900 text-green-300"}`}>
            {matured ? "Matured" : "Active"}
          </span>
        </div>
        <p className="text-gray-400">{agentInfo.description}</p>
        <a href={agentInfo.endpoint} target="_blank" rel="noreferrer"
           className="text-xs text-blue-400 hover:text-blue-300 mt-1 inline-block">
          {agentInfo.endpoint} ↗
        </a>
      </div>

      {/* vault stats */}
      <div className="border border-gray-800 rounded-xl p-6 space-y-4 bg-gray-900">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Vault</h2>

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Raised" value={`$${deposited.toLocaleString()}`} sub={`of $${goal.toLocaleString()}`} />
          <Stat label="Revenue" value={`$${revenue.toLocaleString()}`} />
          <Stat
            label={matured ? "Matured" : "Time left"}
            value={matured ? "✓" : formatTimeLeft(timeLeftSec)}
            sub={maturityDate ? maturityDate.toLocaleDateString() : ""}
          />
        </div>

        {/* funding progress */}
        <div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${fillPct}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">{fillPct.toFixed(1)}% funded</div>
        </div>
      </div>

      {/* LP position */}
      {address && myShares > 0 && (
        <div className="border border-gray-700 rounded-xl p-6 bg-gray-900 space-y-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Your Position</h2>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Deposited" value={`$${myShares.toLocaleString()}`} />
            <Stat label="Est. payout" value={`$${myPayout.toLocaleString()}`} />
          </div>
          {matured && !hasRedeemed && vaultAddress && (
            <RedeemButton vaultAddress={vaultAddress} onSuccess={refetch} />
          )}
          {hasRedeemed && (
            <p className="text-sm text-green-400">Redeemed ✓</p>
          )}
        </div>
      )}

      {/* deposit form */}
      {!matured && address && vaultAddress && (
        <DepositForm
          vaultAddress={vaultAddress}
          usdcBalance={myBalance}
          allowance={allowance ?? 0n}
          onSuccess={refetch}
        />
      )}

      {!address && (
        <p className="text-center text-gray-500 text-sm py-4">
          Connect your wallet to deposit or view your position.
        </p>
      )}

      {matured && !address && (
        <p className="text-center text-gray-500 text-sm py-4">
          This vault has matured. Connect wallet to redeem.
        </p>
      )}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-semibold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function DepositForm({
  vaultAddress,
  usdcBalance,
  allowance,
  onSuccess,
}: {
  vaultAddress: `0x${string}`;
  usdcBalance: number;
  allowance: bigint;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) onSuccess();

  const amountBig = amount ? parseUnits(amount, 6) : 0n;
  const needsApproval = amountBig > 0n && allowance < amountBig;

  function handleApprove() {
    writeContract({
      address: ADDRESSES.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vaultAddress, amountBig],
    });
  }

  function handleDeposit() {
    writeContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amountBig],
    });
  }

  return (
    <div className="border border-gray-800 rounded-xl p-6 bg-gray-900 space-y-4">
      <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Deposit USDC</h2>

      <div className="flex gap-2">
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => setAmount(usdcBalance.toFixed(2))}
          className="text-xs text-gray-400 hover:text-white px-3 py-2 border border-gray-700 rounded-lg transition-colors"
        >
          Max
        </button>
      </div>

      <div className="text-xs text-gray-500">
        Balance: ${usdcBalance.toLocaleString()} USDC
      </div>

      {needsApproval ? (
        <button
          onClick={handleApprove}
          disabled={isPending || isConfirming}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {isPending || isConfirming ? "Approving..." : "Approve USDC"}
        </button>
      ) : (
        <button
          onClick={handleDeposit}
          disabled={!amount || isPending || isConfirming}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {isPending || isConfirming ? "Depositing..." : "Deposit"}
        </button>
      )}
    </div>
  );
}

function RedeemButton({ vaultAddress, onSuccess }: { vaultAddress: `0x${string}`; onSuccess: () => void }) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) onSuccess();

  return (
    <button
      onClick={() => writeContract({ address: vaultAddress, abi: VAULT_ABI, functionName: "redeem" })}
      disabled={isPending || isConfirming}
      className="w-full bg-green-700 hover:bg-green-600 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
    >
      {isPending || isConfirming ? "Redeeming..." : "Redeem Principal + Yield"}
    </button>
  );
}

function formatTimeLeft(sec: number) {
  if (sec <= 0) return "Matured";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h`;
}
