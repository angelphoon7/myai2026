import { NextRequest, NextResponse } from "next/server";
import { db } from "@/whatsapp/firebase";

export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get("phone");
  if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

  const userDoc = await db.collection("users").doc(phone).get();
  if (!userDoc.exists) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const profile = userDoc.data();

  const checkins: Record<string, unknown>[] = [];
  const today = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const doc = await db.collection("checkins").doc(`${phone}_${dateStr}`).get();
    if (doc.exists) {
      checkins.push({ date: dateStr, ...doc.data() });
    }
  }

  return NextResponse.json({ profile, checkins });
}
