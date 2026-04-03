import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Navbar }    from "@/components/Navbar";

export const metadata: Metadata = {
  title: "Rent-an-Agent",
  description: "Tokenize agent revenue. LP capital meets AI.",
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
