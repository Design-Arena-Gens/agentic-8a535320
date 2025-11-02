# Jarvis AI - Emotional Voice Companion

Jarvis AI is a futuristic, voice-first companion packaged as a Next.js web experience that deploys seamlessly to Vercel. It combines a holographic HUD, wake-word speech, emotional text-to-speech, encrypted memory, and automation hooks into a single always-on assistant.

## Core Capabilities

- **Voice presence**: Wake-word detection ("Hey Jarvis"), continuous speech recognition, adaptive waveform visualisation, and ElevenLabs or Web Speech synthesis with tone control.
- **Chat memory**: Encrypted local storage (AES-GCM) keeps conversations on-device.
- **Futuristic HUD**: Circular holographic dashboard, live waveform, automation status, and habit insights.
- **Smart automations**: Natural-language commands for opening apps, searching, or cueing Spotify with actionable feedback.
- **Integrations**: Serverless routes scaffolded for OpenAI GPT/DALL-E, Gmail, Google Calendar, and Spotify with sample data when secrets are missing.
- **Local learning**: Tracks frequent commands to surface one-tap shortcuts that evolve with the user.

## Getting Started

```bash
npm install
npm run dev
```

The app runs on `http://localhost:3000`.

### Required Environment Variables

Create a `.env.local` file to enable live API responses:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini            # optional, defaults to gpt-4o-mini
ELEVENLABS_API_KEY=...              # optional, enables ElevenLabs voice
ELEVENLABS_VOICE_ID=...             # required when ELEVENLABS_API_KEY is set
GMAIL_ACCESS_TOKEN=...              # optional, switches Gmail integration out of demo mode
GOOGLE_CALENDAR_API_KEY=...         # optional, switches Calendar integration out of demo mode
SPOTIFY_CLIENT_ID=...               # optional, switches Spotify integration out of demo mode
SPOTIFY_CLIENT_SECRET=...           # optional, switches Spotify integration out of demo mode
```

Without keys, Jarvis falls back to on-device heuristics and curated sample data so the experience remains usable offline.

### Scripts

- `npm run dev` - start the development server
- `npm run lint` - run ESLint (React 19 rules enabled)
- `npm run build` - create the production bundle (used by Vercel)

## Architecture Overview

- `src/components/JarvisApp.tsx` - master client component orchestrating HUD, chat, voice, and automations.
- `src/hooks/useJarvisVoice.ts` - speech recognition, waveform metering, and text-to-speech fallback logic.
- `src/hooks/usePersistentChat.ts` - encrypted local memory manager.
- `src/hooks/useHabitLearner.ts` - frequent task mining with local storage persistence.
- `src/app/api/*` - serverless routes for chat, voice, automation, DALL-E, and integration stubs.
- `src/lib/encryption.ts` - AES-GCM helpers for secure persistence.

## Testing and Validation

- `npm run lint` for static analysis.
- `npm run build` to confirm the production bundle matches the Vercel build pipeline.

## Deployment

Deploy with the Vercel CLI:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-8a535320
```

Serverless routes expect secrets via Vercel environment variables.

## Security Notes

- Chat history never leaves the browser; AES keys live only in localStorage.
- API routes validate input with `zod` before invoking third-party services.
- External integrations stay in demo mode until credentials are supplied, preventing accidental calls.

## Roadmap Ideas

- Desktop bridge (Electron/Python) for native automation.
- OAuth flows for Gmail, Calendar, and Spotify with token management UI.
- Fine-grained persona editor with emotion blending.
- Advanced waveform rendering powered by WebGL.

---

Crafted for immersive companion experiences. Customize and extend Jarvis to match your assistant vision.
