"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!connected ? (
              <button onClick={openConnectModal} style={btnStyle()}>
                Connect Wallet
              </button>
            ) : (
              <>
                {/* chain button */}
                <button
                  onClick={openChainModal}
                  style={btnStyle(chain.unsupported)}
                  title={chain.unsupported ? "Wrong network" : chain.name}
                >
                  {chain.unsupported ? (
                    <span style={{ color: "#f87171" }}>Wrong network</span>
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: 12 }}>
                      Base Sepolia
                    </span>
                  )}
                </button>

                {/* account button */}
                <button onClick={openAccountModal} style={btnStyle()}>
                  {account.displayName}
                </button>
              </>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

function btnStyle(warning?: boolean): React.CSSProperties {
  return {
    background:   "var(--surface)",
    border:       `1px solid ${warning ? "#f87171" : "var(--border)"}`,
    borderRadius: 7,
    padding:      "6px 14px",
    fontSize:     13,
    color:        "var(--text)",
    cursor:       "pointer",
    fontFamily:   "inherit",
    transition:   "border-color 0.15s",
  };
}
