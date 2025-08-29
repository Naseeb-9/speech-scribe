import { NextResponse } from "next/server";
import { createSpeechmaticsJWT } from "@speechmatics/auth";

export async function GET() {
  const apiKey = process.env.SPEECHMATICS_API_KEY!;
  const jwt = await createSpeechmaticsJWT({ type: "rt", apiKey, ttl: 60 }); // 60s
  return NextResponse.json({ jwt });
}
