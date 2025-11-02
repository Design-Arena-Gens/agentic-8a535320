import { NextResponse } from "next/server";

const SAMPLE_EMAILS = [
  {
    from: "Avery Chen",
    subject: "Sprint sync summary",
    preview: "Wrapping up the action items from today...",
    receivedAt: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
  },
  {
    from: "Morgan from Spotify",
    subject: "New Daily Mix ready",
    preview: "We built a mix around your focus playlists.",
    receivedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
];

const SAMPLE_EVENTS = [
  {
    title: "Product review with Nova",
    start: new Date(Date.now() + 1000 * 60 * 45).toISOString(),
    end: new Date(Date.now() + 1000 * 60 * 75).toISOString(),
    location: "War room · Holo HQ",
  },
  {
    title: "Deep work block",
    start: new Date(Date.now() + 1000 * 60 * 150).toISOString(),
    end: new Date(Date.now() + 1000 * 60 * 270).toISOString(),
    location: "HQ · Lab Pod 7",
  },
];

export async function GET() {
  const gmailConfigured = Boolean(process.env.GMAIL_ACCESS_TOKEN);
  const calendarConfigured = Boolean(process.env.GOOGLE_CALENDAR_API_KEY);

  return NextResponse.json({
    gmail: {
      configured: gmailConfigured,
      emails: gmailConfigured ? [] : SAMPLE_EMAILS,
    },
    calendar: {
      configured: calendarConfigured,
      events: calendarConfigured ? [] : SAMPLE_EVENTS,
    },
  });
}
