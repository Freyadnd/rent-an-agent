"use client";

import { use, useState, useEffect } from "react";
import {
  useAccount, useReadContract, useReadContracts,
  useWriteContract, useWaitForTransactionReceipt,
} from "wagmi";
import { formatUnits, parseUnits, maxUint256 } from "viem";
import { ADDRESSES, REGISTRY_ABI, VAULT_ABI, ERC20_ABI } from "@/lib/contracts";

const REVENUE_LABELS = [
  { bit: 0x01, label: "x402"         },
  { bit: 0x02, label: "Subscription" },
  { bit: 0x04, label: "Trading"      },
];

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

function fmtTimeLeft(sec: number) {
  if (sec <= 0) return "Matured";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h remaining` : `${h}h remaining`;
}

export default function AgentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }      = use(params);
  const agentId     = BigInt(id);
  const { address } = useAccount();

  const { data: agentInfo, isLoading } = useReadContract({
    address: ADDRESSES.registry, abi: REGISTRY_ABI,
    functionName: "getAgent", args: [agentId],
  });

  const vaultAddress = agentInfo?.vault as `0x${string}` | undefined;

  const { data, refetch } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: VAULT_ABI, functionName: "status"      },
      { address: vaultAddress, abi: VAULT_ABI, functionName: "fundingGoal" },
      { address: vaultAddress, abi: VAULT_ABI, functionName: "maturity"    },
      ...(address ? [
        { address: vaultAddress,   abi: VAULT_ABI, functionName: "shares",        args: [address] },
        { address: vaultAddress,   abi: VAULT_ABI, functionName: "redeemed",      args: [address] },
        { address: vaultAddress,   abi: VAULT_ABI, functionName: "previewRedeem", args: [address] },
        { address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "allowance",     args: [address, vaultAddress!] },
        { address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "balanceOf",     args: [address] },
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

  const deposited    = status ? Number(formatUnits(status[0], 6)) : 0;
  const revenue      = status ? Number(formatUnits(status[1], 6)) : 0;
  const timeLeftSec  = status ? Number(status[3]) : 0;
  const matured      = status?.[4] ?? false;
  const goal         = fundingGoal ? Number(formatUnits(fundingGoal, 6)) : 0;
  const fillPct      = goal ? Math.min(100, (deposited / goal) * 100) : 0;
  const maturityDate = maturity ? new Date(Number(maturity) * 1000) : null;
  const myShares     = lpShares    ? Number(formatUnits(lpShares,    6)) : 0;
  const myPayout     = preview     ? Number(formatUnits(preview,     6)) : 0;
  const myBalance    = usdcBalance ? Number(formatUnits(usdcBalance, 6)) : 0;

  const yieldEst = myShares > 0 && myPayout >= myShares
    ? ((myPayout - myShares) / myShares * 100).toFixed(2)
    : null;

  if (isLoading) return <PageSkeleton />;
  if (!agentInfo) return (
    <Centered><span style={{ color: "var(--muted)" }}>Agent not found.</span></Centered>
  );

  const revenueLabels = REVENUE_LABELS.filter(({ bit }) => (agentInfo.revenueTypes & bit) !== 0);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "52px 40px 80px" }}>

      {/* breadcrumb */}
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 28 }}>
        <a href="/" style={{ color: "var(--muted)", textDecoration: "none" }}>Marketplace</a>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "var(--text)" }}>{agentInfo.name}</span>
      </div>

      {/* header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <h1 style={{
            fontSize: 30,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-0.025em",
            color: "var(--text-bright)",
          }}>
            {agentInfo.name}
          </h1>
          <span style={{
            fontSize: 11, fontWeight: 500,
            padding: "3px 10px", borderRadius: 20,
            border: `1px solid ${matured ? "var(--border)" : "var(--accent)"}`,
            color: matured ? "var(--muted)" : "var(--accent)",
          }}>
            {matured ? "matured" : "active"}
          </span>
        </div>

        {agentInfo.description && (
          <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 15, lineHeight: 1.65 }}>
            {agentInfo.description}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a href={agentInfo.endpoint} target="_blank" rel="noreferrer" style={{
            fontSize: 12,
            color: "var(--muted)",
            textDecoration: "none",
            fontFamily: "var(--mono)",
            padding: "3px 8px",
            borderRadius: 4,
            background: "var(--dark-8)",
            border: "1px solid var(--border)",
          }}>
            {agentInfo.endpoint} ↗
          </a>
          {revenueLabels.map(({ label }) => (
            <span key={label} style={{
              fontSize: 11, padding: "3px 8px", borderRadius: 4,
              background: "var(--dark-8)", border: "1px solid var(--border)",
              color: "var(--muted)", fontFamily: "var(--mono)",
            }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* vault overview */}
      <Card style={{ marginBottom: 16 }}>
        <SectionLabel>Vault</SectionLabel>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 4 }}>
          <Stat label="Total raised" value={`$${fmt(deposited)}`} sub={`of $${fmt(goal)}`} />
          <Stat label="Revenue earned" value={`$${fmt(revenue)}`} accent={revenue > 0} border />
          <Stat
            label={matured ? "Status" : "Matures"}
            value={matured ? "Matured" : fmtTimeLeft(timeLeftSec)}
            sub={maturityDate?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            border
          />
        </div>

        {/* bar */}
        <div style={{ marginTop: 20 }}>
          <div style={{
            height: 4, background: "var(--dark-8)",
            borderRadius: 2, overflow: "hidden",
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
            display: "flex", justifyContent: "space-between",
            marginTop: 8, fontSize: 12, color: "var(--muted)",
          }}>
            <span>{fillPct.toFixed(1)}% funded</span>
            <span>{matured ? "Term complete" : `$${fmt(goal - deposited)} remaining`}</span>
          </div>
        </div>
      </Card>

      {/* LP position */}
      {address && myShares > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionLabel>Your position</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginTop: 4 }}>
            <Stat label="Deposited"   value={`$${fmt(myShares)}`} />
            <Stat label="Est. payout" value={`$${fmt(myPayout)}`} border />
            <Stat label="Est. yield"  value={yieldEst ? `+${yieldEst}%` : "—"} accent={!!yieldEst} border />
          </div>
          {matured && !hasRedeemed && vaultAddress && (
            <div style={{ marginTop: 20 }}>
              <RedeemButton vaultAddress={vaultAddress} onSuccess={refetch} />
            </div>
          )}
          {hasRedeemed && (
            <div style={{ marginTop: 16, fontSize: 13, color: "var(--muted)" }}>
              ✓ Redeemed
            </div>
          )}
        </Card>
      )}

      {/* deposit */}
      {!matured && address && vaultAddress && (
        <Card>
          <SectionLabel>Deposit USDC</SectionLabel>
          <div style={{ marginTop: 16 }}>
            <DepositForm
              vaultAddress={vaultAddress}
              usdcBalance={myBalance}
              allowance={allowance ?? 0n}
              onSuccess={refetch}
            />
          </div>
        </Card>
      )}

      {!address && (
        <Card>
          <p style={{ margin: 0, textAlign: "center", color: "var(--muted)", fontSize: 14, padding: "12px 0" }}>
            Connect your wallet to deposit or view your position.
          </p>
        </Card>
      )}
    </div>
  );
}

// ─── shared UI ───────────────────────────────────────────────────────────────

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "22px 24px",
      background: "var(--surface)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600,
      textTransform: "uppercase", letterSpacing: "0.08em",
      color: "var(--muted)",
    }}>
      {children}
    </div>
  );
}

function Stat({ label, value, sub, accent, border }: {
  label:   string;
  value:   string;
  sub?:    string;
  accent?: boolean;
  border?: boolean;
}) {
  return (
    <div style={{
      padding: "16px 0",
      paddingLeft: border ? 20 : 0,
      borderLeft: border ? "1px solid var(--dark-8)" : "none",
    }}>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color: accent ? "var(--accent)" : "var(--text-bright)", letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function DepositForm({
  vaultAddress, usdcBalance, allowance, onSuccess,
}: {
  vaultAddress: `0x${string}`;
  usdcBalance:  number;
  allowance:    bigint;
  onSuccess:    () => void;
}) {
  const [amount, setAmount] = useState("");
  const amountBig    = amount ? parseUnits(amount, 6) : 0n;
  const needsApprove = amountBig > 0n && allowance < amountBig;

  // two separate hooks so we can chain approve → deposit
  const { writeContract: approveWrite, data: approveTxHash, isPending: approvePending } = useWriteContract();
  const { writeContract: depositWrite, data: depositTxHash, isPending: depositPending  } = useWriteContract();

  const { isLoading: approveConfirming, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: depositConfirming, isSuccess: depositSuccess } =
    useWaitForTransactionReceipt({ hash: depositTxHash });

  // approve confirmed → auto-deposit
  useEffect(() => {
    if (approveSuccess && amountBig > 0n) {
      depositWrite({ address: vaultAddress, abi: VAULT_ABI, functionName: "deposit", args: [amountBig] });
    }
  }, [approveSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // deposit confirmed → refresh after short delay for chain state
  useEffect(() => {
    if (depositSuccess) {
      setTimeout(() => { onSuccess(); }, 1500);
      setAmount("");
    }
  }, [depositSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = approvePending || approveConfirming || depositPending || depositConfirming;

  function getLabel() {
    if (approvePending || approveConfirming) return "Approving…";
    if (depositPending || depositConfirming) return "Depositing…";
    return "Deposit";
  }

  function handleDeposit() {
    if (needsApprove) {
      approveWrite({ address: ADDRESSES.usdc, abi: ERC20_ABI, functionName: "approve", args: [vaultAddress, maxUint256] });
    } else {
      depositWrite({ address: vaultAddress, abi: VAULT_ABI, functionName: "deposit", args: [amountBig] });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number" placeholder="0.00" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            flex: 1,
            background: "var(--dark-8)",
            border: "1px solid var(--border)",
            borderRadius: 7,
            padding: "11px 16px",
            fontSize: 15,
            outline: "none",
            color: "var(--text-bright)",
          }}
        />
        <button
          onClick={() => setAmount(usdcBalance.toFixed(2))}
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: 7, padding: "11px 16px",
            color: "var(--muted)", fontSize: 13, cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Max
        </button>
      </div>

      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        Balance: {fmt(usdcBalance)} USDC
        {needsApprove && !busy && (
          <span style={{ marginLeft: 8, color: "var(--accent)" }}>· One-time approval required</span>
        )}
      </div>

      <PrimaryBtn onClick={handleDeposit} disabled={!amount || amountBig === 0n || busy}>
        {getLabel()}
      </PrimaryBtn>
    </div>
  );
}

function RedeemButton({ vaultAddress, onSuccess }: { vaultAddress: `0x${string}`; onSuccess: () => void }) {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) onSuccess();
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PrimaryBtn
      onClick={() => writeContract({ address: vaultAddress, abi: VAULT_ABI, functionName: "redeem" })}
      disabled={isPending || isConfirming}
    >
      {isPending || isConfirming ? "Waiting for transaction…" : "Redeem Principal + Yield"}
    </PrimaryBtn>
  );
}

function PrimaryBtn({ onClick, disabled, children }: {
  onClick:  () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:   disabled ? "var(--dark-8)" : "var(--accent)",
      color:        disabled ? "var(--muted)"  : "#fff",
      border:       "none",
      borderRadius: 7,
      padding:      "12px 20px",
      fontSize:     14,
      fontWeight:   600,
      cursor:       disabled ? "not-allowed" : "pointer",
      width:        "100%",
      letterSpacing: "-0.01em",
      transition:   "opacity 0.15s",
    }}>
      {children}
    </button>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
      {children}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "52px 40px" }}>
      {[40, 140, 120].map((h, i) => (
        <div key={i} style={{
          height: h,
          background: "var(--surface)",
          borderRadius: 10,
          marginBottom: 16,
          opacity: 0.5,
        }} />
      ))}
    </div>
  );
}
