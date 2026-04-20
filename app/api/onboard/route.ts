import { NextRequest, NextResponse } from "next/server";
import { db } from "@/whatsapp/firebase";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { phone, ...profile } = body;

  if (!phone) {
    return NextResponse.json({ error: "phone required" }, { status: 400 });
  }

  await db.collection("users").doc(phone).set({
    phone,
    onboarded: false,
    step: 1,
    ...profile,
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
