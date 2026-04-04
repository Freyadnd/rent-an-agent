"use client";

import { useState, useEffect } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useRouter } from "next/navigation";
import { ADDRESSES, REGISTRY_ABI } from "@/lib/contracts";

const TERM_OPTIONS = [
  { label: "30 days",  seconds: 30  * 86400 },
  { label: "60 days",  seconds: 60  * 86400 },
  { label: "90 days",  seconds: 90  * 86400 },
  { label: "180 days", seconds: 180 * 86400 },
];

const REVENUE_TYPES = [
  {
    bit:   0x01,
    label: "x402 Pay-per-use",
    desc:  "Users pay USDC per API call via the x402 HTTP protocol. Revenue lands in your OWS wallet and is periodically swept into the vault.",
  },
  {
    bit:   0x02,
    label: "Subscription",
    desc:  "Users pay a recurring on-chain fee for access. Payments flow directly into the vault — no sweep required.",
  },
  {
    bit:   0x04,
    label: "Trading / On-chain fees",
    desc:  "Agent earns from on-chain activity (arbitrage, LP fees, etc.). Profits are swept from the OWS wallet into the vault.",
  },
];

export default function RegisterPage() {
  const { address } = useAccount();
  const router      = useRouter();

  const [form, setForm] = useState({
    owsWallet: "", name: "", endpoint: "", description: "",
    termIndex: 1, fundingGoal: "", sweeper: "", revenueTypes: 0,
  });

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        router.refresh();
        router.push("/");
      }, 1500);
    }
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key: string, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleBit = (bit: number) =>
    setForm((f) => ({ ...f, revenueTypes: f.revenueTypes ^ bit }));

  const canSubmit = !!form.name && !!form.owsWallet && !!form.endpoint && !!form.fundingGoal && form.revenueTypes !== 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const maturity = BigInt(Math.floor(Date.now() / 1000) + TERM_OPTIONS[form.termIndex].seconds);
    writeContract({
      address: ADDRESSES.registry, abi: REGISTRY_ABI,
      functionName: "registerAgent",
      args: [
        form.owsWallet as `0x${string}`,
        form.name, form.endpoint, form.description,
        maturity,
        parseUnits(form.fundingGoal, 6),
        (form.sweeper || address) as `0x${string}`,
        form.revenueTypes,
      ],
    });
  }

  if (!address) return (
    <div style={{ maxWidth: 560, margin: "80px auto", padding: "0 40px", textAlign: "center" }}>
      <p style={{ color: "var(--muted)", fontSize: 15 }}>Connect your wallet to list an agent.</p>
    </div>
  );

  const busy = isPending || isConfirming;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "52px 40px 80px" }}>

      {/* page header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontSize: 30, fontWeight: 700, margin: "0 0 10px",
          letterSpacing: "-0.025em", color: "var(--text-bright)",
        }}>
          List your agent
        </h1>
        <p style={{ margin: 0, fontSize: 15, color: "var(--muted)", lineHeight: 1.6 }}>
          Register on-chain. LPs fund your agent, you run it, they earn yield.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>

        {/* identity */}
        <FieldGroup>
          <Field label="Agent Name" required hint="Shown to LPs on the marketplace.">
            <TextInput placeholder="Research Assistant v1" value={form.name} onChange={(v) => set("name", v)} required />
          </Field>
          <Field label="Description">
            <TextInput textarea placeholder="What does your agent do? What data does it use? What&apos;s its edge?" value={form.description} onChange={(v) => set("description", v)} />
          </Field>
        </FieldGroup>

        {/* technical */}
        <FieldGroup>
          <Field label="OWS Wallet Address" required hint="Created with ows wallet create. x402 payments and trading profits land here before being swept into the vault.">
            <TextInput mono placeholder="0x…" value={form.owsWallet} onChange={(v) => set("owsWallet", v)} required />
          </Field>
          <Field label="AWS Endpoint" required hint="Your agent&apos;s public API URL. x402 clients call this directly; subscription access is also validated here.">
            <TextInput placeholder="https://agent.example.com" value={form.endpoint} onChange={(v) => set("endpoint", v)} required />
          </Field>
          <Field label="Sweeper Address" hint="The EOA your backend uses to call receiveRevenue() on the vault. Leave blank to use your connected wallet.">
            <TextInput mono placeholder="0x… (optional)" value={form.sweeper} onChange={(v) => set("sweeper", v)} />
          </Field>
        </FieldGroup>

        {/* revenue sources */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
            Revenue sources <Required />
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            How does your agent earn? Select all that apply.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {REVENUE_TYPES.map(({ bit, label, desc }) => {
              const active = (form.revenueTypes & bit) !== 0;
              return (
                <button
                  key={bit} type="button" onClick={() => toggleBit(bit)}
                  style={{
                    textAlign:    "left",
                    background:   active ? "var(--surface-alt)" : "var(--surface)",
                    border:       `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 8,
                    padding:      "14px 16px",
                    cursor:       "pointer",
                    display:      "flex",
                    gap:          14,
                    alignItems:   "flex-start",
                    transition:   "border-color 0.15s, background 0.15s",
                  }}
                >
                  <div style={{
                    width:          17, height: 17, borderRadius: 4, flexShrink: 0, marginTop: 1,
                    border:         `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background:     active ? "var(--accent)" : "transparent",
                    display:        "flex", alignItems: "center", justifyContent: "center",
                    transition:     "border-color 0.15s, background 0.15s",
                  }}>
                    {active && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-bright)", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>{desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* vault config */}
        <FieldGroup>
          <Field label="Funding Goal (USDC)" required hint="Maximum LPs can deposit. Vault closes once reached.">
            <div style={{ position: "relative" }}>
              <span style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, color: "var(--muted)", pointerEvents: "none",
              }}>$</span>
              <input
                type="number" min="1" placeholder="10,000" value={form.fundingGoal}
                onChange={(e) => set("fundingGoal", e.target.value)} required
                style={{
                  width: "100%", background: "var(--dark-8)",
                  border: "1px solid var(--border)", borderRadius: 7,
                  padding: "11px 14px 11px 28px",
                  fontSize: 15, outline: "none", color: "var(--text-bright)",
                }}
              />
            </div>
          </Field>

          <Field label="Term Length" hint="LPs cannot redeem before maturity.">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {TERM_OPTIONS.map((opt, i) => (
                <button key={i} type="button" onClick={() => set("termIndex", i)} style={{
                  padding: "10px 0", borderRadius: 7, cursor: "pointer",
                  border: `1.5px solid ${form.termIndex === i ? "var(--accent)" : "var(--border)"}`,
                  background: form.termIndex === i ? "var(--accent-dim)" : "var(--dark-8)",
                  color: form.termIndex === i ? "var(--accent)" : "var(--muted)",
                  fontSize: 13, fontWeight: form.termIndex === i ? 600 : 400,
                  transition: "border-color 0.15s, background 0.15s, color 0.15s",
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>
        </FieldGroup>

        {error && (
          <div style={{
            fontSize: 13, color: "#f87171", lineHeight: 1.5,
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: 7, padding: "12px 16px",
          }}>
            {error.message.slice(0, 200)}
          </div>
        )}

        <button type="submit" disabled={busy || !canSubmit} style={{
          background:   busy || !canSubmit ? "var(--dark-8)"  : "var(--accent)",
          color:        busy || !canSubmit ? "var(--muted)"   : "#fff",
          border:       "none", borderRadius: 7,
          padding:      "13px 24px",
          fontSize:     15, fontWeight: 600, letterSpacing: "-0.01em",
          cursor:       busy || !canSubmit ? "not-allowed" : "pointer",
          transition:   "background 0.15s",
          width:        "100%",
        }}>
          {busy ? "Registering…" : "Register Agent"}
        </button>

      </form>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function FieldGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 10,
      padding: "20px 20px 4px",
      background: "var(--surface)",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      {children}
    </div>
  );
}

function Field({ label, hint, required: req, children }: {
  label:     string;
  hint?:     string;
  required?: boolean;
  children:  React.ReactNode;
}) {
  return (
    <div style={{ paddingBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{label}</label>
        {req && <Required />}
      </div>
      {children}
      {hint && <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>{hint}</p>}
    </div>
  );
}

function Required() {
  return <span style={{ color: "var(--accent)", fontSize: 12 }}>*</span>;
}

function TextInput({ placeholder, value, onChange, required, textarea, mono }: {
  placeholder: string;
  value:       string;
  onChange:    (v: string) => void;
  required?:   boolean;
  textarea?:   boolean;
  mono?:       boolean;
}) {
  const s: React.CSSProperties = {
    width: "100%", background: "var(--dark-8)",
    border: "1px solid var(--border)", borderRadius: 7,
    padding: "10px 14px",
    fontSize: 14, outline: "none",
    fontFamily: mono ? "var(--mono)" : "inherit",
    resize: "none",
  };

  return textarea
    ? <textarea placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={s} />
    : <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} required={required} style={s} />;
}
