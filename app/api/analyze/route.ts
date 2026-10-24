import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.length > 6000) {
      return NextResponse.json(
        { error: "নোটিশের লেখা দিন (সর্বোচ্চ ৬০০০ অক্ষর)" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);
    const system = `You analyze university notices (Bangla, English, or mixed).
Today is ${today}. Reply with ONLY valid JSON in this shape:
{"summary":"3 short lines in simple Bangla",
"deadlines":[{"title":"","date":"YYYY-MM-DD or null","note":""}],
"documents":["papers or fees required"],
"actions":["step-by-step things to do"]}
Never invent dates. If a date is missing, use null.`;

    const res = await fetch(`${process.env.OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error ?? "Model error" },
        { status: res.status }
      );
    }

    const raw: string = data.message?.content ?? "";
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return NextResponse.json({ result: parsed });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "বিশ্লেষণ ব্যর্থ হয়েছে, আবার চেষ্টা করুন" },
      { status: 500 }
    );
  }
}