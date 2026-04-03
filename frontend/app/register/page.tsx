"use client";

import { useState } from "react";
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useRouter } from "next/navigation";
import { ADDRESSES, REGISTRY_ABI } from "@/lib/contracts";

const TERM_OPTIONS = [
  { label: "30 days",  seconds: 30 * 86400  },
  { label: "60 days",  seconds: 60 * 86400  },
  { label: "90 days",  seconds: 90 * 86400  },
  { label: "180 days", seconds: 180 * 86400 },
];

export default function RegisterPage() {
  const { address } = useAccount();
  const router = useRouter();

  const [form, setForm] = useState({
    owsWallet:   "",
    name:        "",
    endpoint:    "",
    description: "",
    termIndex:   0,
    fundingGoal: "",
    sweeper:     "",
  });

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess) {
    router.push("/");
  }

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const maturity = BigInt(Math.floor(Date.now() / 1000) + TERM_OPTIONS[form.termIndex].seconds);
    const goal = parseUnits(form.fundingGoal, 6);

    writeContract({
      address: ADDRESSES.registry,
      abi:     REGISTRY_ABI,
      functionName: "registerAgent",
      args: [
        form.owsWallet as `0x${string}`,
        form.name,
        form.endpoint,
        form.description,
        maturity,
        goal,
        (form.sweeper || address) as `0x${string}`,
      ],
    });
  }

  if (!address) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24 text-center">
        <p className="text-gray-400">Connect your wallet to list an agent.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">List Your Agent</h1>
      <p className="text-gray-400 mb-8 text-sm">
        Register your agent on-chain. LPs can fund it and share in its revenue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          label="Agent Name"
          placeholder="e.g. Research Assistant v1"
          value={form.name}
          onChange={(v) => set("name", v)}
          required
        />
        <Field
          label="OWS Wallet Address"
          placeholder="0x... (from: ows wallet create)"
          value={form.owsWallet}
          onChange={(v) => set("owsWallet", v)}
          required
        />
        <Field
          label="AWS Endpoint"
          placeholder="https://agent.example.com"
          value={form.endpoint}
          onChange={(v) => set("endpoint", v)}
          required
        />
        <Field
          label="Description"
          placeholder="What does your agent do?"
          value={form.description}
          onChange={(v) => set("description", v)}
          textarea
        />
        <Field
          label="Sweeper Address"
          placeholder="0x... (your backend wallet that sends revenue to vault)"
          value={form.sweeper}
          onChange={(v) => set("sweeper", v)}
          hint="Leave blank to use your connected wallet."
        />

        {/* funding goal */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Funding Goal (USDC)</label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 10000"
            value={form.fundingGoal}
            onChange={(e) => set("fundingGoal", e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* term */}
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Term Length</label>
          <div className="grid grid-cols-4 gap-2">
            {TERM_OPTIONS.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => set("termIndex", i)}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.termIndex === i
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-3">
            {error.message.slice(0, 120)}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || isConfirming}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          {isPending || isConfirming ? "Registering..." : "Register Agent"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label, placeholder, value, onChange, required, textarea, hint,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  textarea?: boolean;
  hint?: string;
}) {
  const cls = "w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500";
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">{label}</label>
      {textarea ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={cls + " resize-none"}
        />
      ) : (
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={cls}
        />
      )}
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}
