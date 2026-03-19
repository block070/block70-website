import { NextResponse } from "next/server";
import { smartMoneyWallets } from "@/data/smartMoneyWallets";

export async function GET() {
  return NextResponse.json({
    items: smartMoneyWallets,
    total: smartMoneyWallets.length,
  });
}

