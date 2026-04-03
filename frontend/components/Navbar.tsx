"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  return (
    <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          rent-an-agent
        </Link>
        <div className="flex gap-6 text-sm text-gray-400">
          <Link href="/" className="hover:text-white transition-colors">
            Marketplace
          </Link>
          <Link href="/register" className="hover:text-white transition-colors">
            List Agent
          </Link>
        </div>
      </div>
      <ConnectButton chainStatus="icon" showBalance={false} />
    </nav>
  );
}
