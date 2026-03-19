import { NextResponse } from "next/server";
import { getLiveWallet } from "@/lib/smart-money-live";

type RouteContext = { params: { chain: string; address: string } };

export async function GET(_: Request, { params }: RouteContext) {
  const chain = params.chain as "bitcoin" | "ethereum" | "solana";
  if (chain !== "bitcoin" && chain !== "ethereum" && chain !== "solana") {
    return NextResponse.json({ detail: "Invalid chain" }, { status: 400 });
  }

  const live = await getLiveWallet(chain, params.address);
  return NextResponse.json({
    ...live,
  });
}

