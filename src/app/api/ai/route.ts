// app/api/ai/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

// ====== HARD-CODED KEY (server-side only) ======
const API_KEY = process.env.OPEN_AI_API_KEY!;
const client = new OpenAI({ apiKey: API_KEY });

// Prefer Chat Completions for broad compatibility
export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Empty prompt" }, { status: 400 });
    }

    // Option A: Chat Completions (stable)
    const resp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Summarize or answer based on the provided transcript.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const reply = resp.choices?.[0]?.message?.content || "";

  
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("AI route error:", err);
    return NextResponse.json(
      { error: "Failed to contact OpenAI" },
      { status: 500 }
    );
  }
}
