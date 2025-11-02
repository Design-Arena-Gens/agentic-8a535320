import { NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  prompt: z.string().min(5),
  size: z.enum(["256x256", "512x512", "1024x1024"]).optional(),
});

const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = payloadSchema.parse(body);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          image: null,
          provider: "offline",
          message:
            "Image generation requires an OpenAI API key. Add OPENAI_API_KEY in your environment configuration.",
        },
        { status: 200 },
      );
    }

    const response = await fetch(OPENAI_IMAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: payload.prompt,
        size: payload.size ?? "512x512",
        model: "gpt-image-1",
      }),
    });

    if (!response.ok) {
      console.error("Image generation request failed", await response.text());
      return NextResponse.json(
        { error: "Failed to generate image" },
        { status: 500 },
      );
    }

    const data = await response.json();
    return NextResponse.json({
      image: data.data?.[0]?.url ?? null,
      provider: "openai",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid image payload" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Unable to generate image" },
      { status: 500 },
    );
  }
}
