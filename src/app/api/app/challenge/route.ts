import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { appRoutesConfigured, issueChallenge } from "@/lib/server/appDb";
import { err } from "@/lib/server/appCaller";

export const dynamic = "force-dynamic";

/** A one-time challenge for registering an iPhone's key (decision 0003). */
export async function GET() {
  if (!appRoutesConfigured()) {
    return err(503, "Preparing studies from the iPhone isn't set up on the server yet.", "unavailable");
  }
  const challenge = randomBytes(32).toString("base64");
  try {
    await issueChallenge(challenge);
  } catch (e) {
    console.error("challenge failed", e);
    return err(500, "Couldn't start registering this iPhone — try again.");
  }
  return NextResponse.json({ challenge }, { headers: { "Cache-Control": "no-store" } });
}
