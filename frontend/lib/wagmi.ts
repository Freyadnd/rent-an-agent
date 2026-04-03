"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base } from "wagmi/chains";

export const wagmiConfig = getDefaultConfig({
  appName:   "Rent-an-Agent",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "placeholder",
  chains:    [base],
  ssr:       true,
});
