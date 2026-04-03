"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Navbar() {
  const path = usePathname();

  return (
    <header style={{
      borderBottom: "1px solid var(--border)",
      padding: "0 40px",
      height: 58,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      background: "rgba(36,36,36,0.90)",
      backdropFilter: "blur(16px)",
      zIndex: 100,
    }}>
      <nav style={{ display: "flex", alignItems: "center", gap: 40 }}>
        <Link href="/" style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-bright)",
          textDecoration: "none",
          letterSpacing: "-0.01em",
        }}>
          rent-an-agent
        </Link>

        <div style={{ display: "flex", gap: 6 }}>
          {[
            { href: "/",         label: "Marketplace" },
            { href: "/register", label: "List Agent"  },
          ].map(({ href, label }) => (
            <Link key={href} href={href} style={{
              fontSize: 13,
              padding: "5px 10px",
              borderRadius: 6,
              color: path === href ? "var(--text-bright)" : "var(--muted)",
              textDecoration: "none",
              background: path === href ? "var(--surface)" : "transparent",
              transition: "color 0.15s, background 0.15s",
            }}>
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <ConnectButton chainStatus="none" showBalance={false} />
    </header>
  );
}
