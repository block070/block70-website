import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Block70 – Crypto Opportunity Intelligence",
  description: "Discover the easiest money in crypto right now.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}

