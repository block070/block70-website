import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("block70_session", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  res.cookies.set("block70_plan", "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
  });
  return res;
}

