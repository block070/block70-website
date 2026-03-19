import { NextResponse } from "next/server";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";

type RouteContext = { params: { chain: string; address: string } };

export async function GET(_: Request, { params }: RouteContext) {
  const row = smartMoneyWallets.find(
    (w) => w.chain === params.chain && w.address.toLowerCase() === params.address.toLowerCase(),
  );
  if (!row) {
    return NextResponse.json({ detail: "Wallet not found" }, { status: 404 });
  }
  return NextResponse.json(row);
}

