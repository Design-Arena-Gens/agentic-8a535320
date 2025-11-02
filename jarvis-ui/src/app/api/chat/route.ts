import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  message: z.string().min(1),
  tone: z.enum(["cheerful", "calm", "serious", "neutral"]).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .optional(),
});

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

function inferToneFromText(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("excited") || lower.includes("awesome")) {
    return "cheerful";
  }
  if (lower.includes("worried") || lower.includes("anxious")) {
    return "calm";
  }
  if (lower.includes("urgent") || lower.includes("serious")) {
    return "serious";
  }
  return "neutral";
}

async function callOpenAI(prompt: string, history: unknown) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.8,
      messages: [
        {
          role: "system",
          content:
            "You are Jarvis, an emotional AI assistant. Speak with warmth, confidence, and gentle wit. Keep responses concise but empathetic. Offer proactive help with automation, integrations and task planning. When relevant, suggest automations or visual responses.",
        },
        ...(Array.isArray(history) ? history : []),
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    console.error("OpenAI request failed", await response.text());
    return null;
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message?.content as string | undefined;
  return message ?? "";
}

function offlineFallback(prompt: string) {
  const templates = [
    "I hear you. {insight} What can I take off your plate next?",
    "Logged. {insight} Point me at the next task and I will line it up.",
    "Noted. {insight} Want me to queue anything else while we're in flow?",
  ];
  const insights = [
    "Let's anchor your breathing while I plot the steps.",
    "I'll keep an eye on your schedule and nudge you before the next event.",
    "I've stored that preference for future runs.",
  ];

  const template =
    templates[Math.floor(Math.random() * templates.length)] ?? templates[0];
  const insight = insights[Math.floor(Math.random() * insights.length)] ?? "";
  return template
    .replace("{insight}", insight)
    .concat(`\n\n(offline fallback • unable to reach OpenAI)`)
    .concat(`\nYou said: "${prompt}".`);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);
    const trimmedHistory = payload.history?.slice(-12);
    const tone = payload.tone ?? inferToneFromText(payload.message);

    const response =
      (await callOpenAI(payload.message, trimmedHistory)) ??
      offlineFallback(payload.message);

    return NextResponse.json({
      reply: response,
      tone,
      provider: process.env.OPENAI_API_KEY ? "openai" : "offline",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    console.error("Chat route error", error);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 },
    );
  }
}
