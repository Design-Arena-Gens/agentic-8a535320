import { NextResponse } from "next/server";
import { z } from "zod";

const payloadSchema = z.object({
  command: z.string().min(2),
});

const knowledgeBase = new Map<string, string>([
  [
    "open spotify",
    "Use the Spotify web player: https://open.spotify.com/ to continue playback. Jarvis can control playback via the Spotify Web API when client credentials are configured.",
  ],
  [
    "open gmail",
    "Navigating to https://mail.google.com/. Jarvis can summarise unread emails once Gmail API credentials are provided.",
  ],
  [
    "open calendar",
    "Accessing Google Calendar at https://calendar.google.com/. Jarvis can create events using the Calendar API when configured.",
  ],
]);

function interpretCommand(command: string) {
  const trimmed = command.trim().toLowerCase();
  if (trimmed.startsWith("open ")) {
    const target = trimmed.replace("open ", "").trim();
    const base = knowledgeBase.get(`open ${target}`) ?? command;
    return {
      status: "success" as const,
      details: base,
    };
  }
  if (trimmed.startsWith("search ")) {
    const terms = trimmed.replace("search ", "").trim();
    return {
      status: "success" as const,
      details: `Opening a local search for "${terms}". Press ⊞ Win + S to search Windows for this query.`,
    };
  }
  if (trimmed.startsWith("play ")) {
    const track = trimmed.replace("play ", "").trim();
    return {
      status: "success" as const,
      details: `Triggering Spotify playback for "${track}". Use the Spotify connect device list to target your desktop client.`,
    };
  }

  return {
    status: "unsupported" as const,
    details:
      "This automation requires native desktop permissions. Use the desktop bridge to enable direct control.",
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { command } = payloadSchema.parse(body);
    const result = interpretCommand(command);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid command payload" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Unable to perform automation" },
      { status: 500 },
    );
  }
}
