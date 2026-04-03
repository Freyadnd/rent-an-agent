import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar }    from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Agent Bonds",
  description: "Tokenized cashflows of AI agents, funded by LPs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
