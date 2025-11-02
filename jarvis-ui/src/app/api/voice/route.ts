import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  text: z.string().min(1),
  tone: z.enum(["cheerful", "calm", "serious", "neutral"]).optional(),
});

const VOICE_MAP: Record<string, string> = {
  cheerful: "cheerful",
  calm: "soothing",
  serious: "narration",
  neutral: "default",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = requestSchema.parse(body);

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      return NextResponse.json(
        {
          audio: null,
          provider: "web-speech",
        },
        { status: 200 },
      );
    }

    const style = VOICE_MAP[payload.tone ?? "neutral"];
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: payload.text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: style === "narration" ? 0.4 : 0.65,
            similarity_boost: 0.75,
            style: style,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("ElevenLabs request failed", await response.text());
      return NextResponse.json(
        {
          audio: null,
          provider: "web-speech",
        },
        { status: 200 },
      );
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    return NextResponse.json({
      audio: audioBase64,
      provider: "elevenlabs",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid voice payload" },
        { status: 400 },
      );
    }
    console.error("Voice route error", error);
    return NextResponse.json(
      { error: "Unable to generate voice" },
      { status: 500 },
    );
  }
}
