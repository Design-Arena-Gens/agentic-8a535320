import { NextResponse } from "next/server";

const SAMPLE_PLAYLISTS = [
  {
    id: "holo-focus",
    name: "Neo Focus",
    description: "Cinematic synths engineered for deep focus.",
    image:
      "https://images.unsplash.com/photo-1545239351-1141bd82e8a6?auto=format&fit=crop&w=300&q=60",
  },
  {
    id: "jarvis-daily",
    name: "Jarvis Daily Companion",
    description: "A bespoke mix tuned to your weekly habits.",
    image:
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=300&q=60",
  },
];

export async function GET() {
  const configured = Boolean(
    process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET,
  );

  return NextResponse.json({
    configured,
    playlists: configured ? [] : SAMPLE_PLAYLISTS,
  });
}
