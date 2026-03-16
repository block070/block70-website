import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Block70 App",
  description: "Block70 opportunity intelligence application.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
          <header className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">
                Block70 App
              </h1>
              <p className="mt-1 text-xs text-slate-400">
                Internal opportunity dashboard and tooling.
              </p>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

