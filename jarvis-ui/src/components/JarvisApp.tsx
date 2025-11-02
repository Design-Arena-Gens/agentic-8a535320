"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type {
  AssistantState,
  AutomationResult,
  ChatMessage,
  VoiceTone,
} from "@/types";
import { usePersistentChat } from "@/hooks/usePersistentChat";
import { useJarvisVoice } from "@/hooks/useJarvisVoice";
import { useHabitLearner } from "@/hooks/useHabitLearner";
import VoiceWaveform from "./VoiceWaveform";

const DEFAULT_WAKE_WORD = "hey jarvis";

const toneOptions: { tone: VoiceTone; label: string }[] = [
  { tone: "cheerful", label: "Cheerful" },
  { tone: "calm", label: "Calm" },
  { tone: "serious", label: "Serious" },
  { tone: "neutral", label: "Neutral" },
];

const personaPrompts: AssistantState["personality"][] = [
  "caring",
  "witty",
  "confident",
];

function makeMessage(role: ChatMessage["role"], content: string, tone?: VoiceTone) {
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${role}-${Date.now()}-${Math.random()}`,
    role,
    content,
    createdAt: Date.now(),
    tone,
  } satisfies ChatMessage;
}

export function JarvisApp() {
  const [state, setState] = useState<AssistantState>({
    listening: false,
    speaking: false,
    wakeWord: DEFAULT_WAKE_WORD,
    tone: "calm",
    personality: "caring",
    alwaysListening: true,
  });
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [automationResult, setAutomationResult] = useState<AutomationResult | null>(null);
  const [hudAwake, setHudAwake] = useState(false);

  const { history, addMessage, clearHistory } = usePersistentChat();
  const { suggestions, registerHabit } = useHabitLearner(history);

  const voice = useJarvisVoice({
    wakeWord: state.wakeWord,
    tone: state.tone,
    alwaysListening: state.alwaysListening,
    onWake: () => {
      setHudAwake(true);
      void voice.speak({ text: "Online. How can I help?", tone: state.tone });
    },
    onFinalTranscript: (transcript) => {
      const cleaned = transcript.replace(new RegExp(state.wakeWord, "ig"), "").trim();
      if (!cleaned) {
        return;
      }
      void handleSubmit(cleaned, true);
    },
  });

  const primaryToneLabel = useMemo(
    () => toneOptions.find((option) => option.tone === state.tone)?.label ?? "Calm",
    [state.tone],
  );

  const sendAutomation = useCallback(
    async (command: string) => {
      try {
        const response = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const result = (await response.json()) as AutomationResult;
        setAutomationResult(result);
        if (command.toLowerCase().startsWith("open ")) {
          registerHabit({
            command,
            label: `Open ${command.replace(/open\s+/i, "")}`,
            description: "One-tap automation from your quick actions.",
            frequency: 1,
          });
        }
      } catch (error) {
        console.warn("Automation command failed", error);
      }
    },
    [registerHabit],
  );

  const handleSubmit = useCallback(
    async (value: string, fromVoice = false) => {
      const trimmed = value.trim();
      if (!trimmed || pending) {
        return;
      }
      setPending(true);
      const userMessage = makeMessage("user", trimmed);
      addMessage(userMessage);

      if (/^(open|play|search)/i.test(trimmed)) {
        void sendAutomation(trimmed);
      }

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            tone: state.tone,
            history: history.slice(-10).map(({ role, content }) => ({ role, content })),
          }),
        });

        const data = await response.json();
        const reply = typeof data?.reply === "string" ? data.reply : "I am online and listening.";

        const assistantMessage = makeMessage("assistant", reply, data.tone ?? state.tone);
        addMessage(assistantMessage);

        if (!fromVoice) {
          void voice.speak({ text: reply, tone: data.tone ?? state.tone });
        }
      } catch (error) {
        console.error("Chat request failed", error);
        const fallback = makeMessage(
          "assistant",
          "I hit a snag reaching my reasoning core. I've logged the issue and will retry soon.",
          "serious",
        );
        addMessage(fallback);
      } finally {
        setPending(false);
        if (!fromVoice) {
          setInput("");
        }
      }
    },
    [addMessage, history, pending, sendAutomation, state.tone, voice],
  );

  useEffect(() => {
    setState((prev) => ({ ...prev, listening: voice.listening, speaking: voice.speaking }));
  }, [voice.listening, voice.speaking]);

  useEffect(() => {
    if (!hudAwake) {
      return;
    }
    const timeout = setTimeout(() => setHudAwake(false), 3200);
    return () => clearTimeout(timeout);
  }, [hudAwake]);

  useEffect(() => {
    if (!automationResult) {
      return;
    }
    const timeout = setTimeout(() => setAutomationResult(null), 8000);
    return () => clearTimeout(timeout);
  }, [automationResult]);

  const handleToneChange = (tone: VoiceTone) => {
    setState((prev) => ({ ...prev, tone }));
  };

  const toggleListening = () => {
    if (voice.muted) {
      voice.setMuted(false);
      void voice.startListening();
      return;
    }
    if (state.listening) {
      voice.stopListening();
    } else {
      void voice.startListening();
    }
    setState((prev) => ({ ...prev, listening: !prev.listening }));
  };

  const toggleMute = () => {
    voice.setMuted(!voice.muted);
    if (!voice.muted) {
      voice.stopListening();
    } else if (state.alwaysListening) {
      void voice.startListening();
    }
  };

  return (
    <div className="mx-auto flex h-full min-h-[100vh] w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-8">
      <header className="flex flex-col justify-between gap-6 rounded-3xl border border-cyan-500/20 bg-slate-950/60 p-6 shadow-[0_0_120px_rgba(13,148,255,0.15)] backdrop-blur-xl ring-1 ring-cyan-400/10 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/50 bg-slate-900/80 shadow-[0_0_20px_rgba(56,189,248,0.55)]">
            <Bot className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-wide text-cyan-200">Jarvis AI</p>
            <p className="text-sm text-slate-300/70">Emotional Voice Companion</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 rounded-full border border-cyan-400/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-100">
            <Sparkles className="h-4 w-4" /> {state.personality}
          </span>
          <button
            type="button"
            onClick={toggleListening}
            className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30"
          >
            {state.listening ? (
              <>
                <Mic className="h-4 w-4" /> Listening
              </>
            ) : (
              <>
                <MicOff className="h-4 w-4" /> Idle
              </>
            )}
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="rounded-full border border-cyan-400/30 p-2 text-cyan-100 transition hover:bg-cyan-500/10"
            aria-label={voice.muted ? "Unmute microphone" : "Mute microphone"}
          >
            {voice.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() =>
              setState((prev) => ({
                ...prev,
                personality:
                  personaPrompts[(personaPrompts.indexOf(prev.personality) + 1) % personaPrompts.length],
              }))
            }
            className="rounded-full border border-cyan-400/30 p-2 text-cyan-100 transition hover:bg-cyan-500/10"
            aria-label="Cycle personality"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="grid flex-1 gap-10 lg:grid-cols-[1.1fr_1fr]">
        <section className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-cyan-500/30 bg-slate-950/70 p-10 shadow-[0_0_180px_rgba(56,189,248,0.25)] backdrop-blur-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_55%)]" />
          <div className="relative flex h-full w-full flex-col items-center justify-between gap-8">
            <div className="flex w-full items-center justify-between text-xs uppercase tracking-[0.3em] text-cyan-200/70">
              <span>Wake • {state.wakeWord}</span>
              <span>Mood • {primaryToneLabel}</span>
            </div>
            <div className="relative flex h-80 w-80 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-900/60 shadow-[0_0_80px_rgba(56,189,248,0.4)]">
              <div className="absolute inset-6 rounded-full border border-cyan-300/30" />
              <motion.div
                animate={{
                  scale: state.listening ? 1.05 : 1,
                  boxShadow: state.listening ? "0 0 90px rgba(56,189,248,0.6)" : "0 0 35px rgba(56,189,248,0.2)",
                }}
                transition={{ type: "spring", stiffness: 140, damping: 16 }}
                className="relative z-10 flex h-44 w-44 items-center justify-center rounded-full bg-cyan-500/20"
              >
                <VoiceWaveform level={voice.audioLevel} active={state.listening} />
              </motion.div>
              <AnimatePresence>
                {hudAwake && (
                  <motion.span
                    key="awake-pill"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="absolute -bottom-12 rounded-full border border-cyan-300/40 bg-cyan-500/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-cyan-100"
                  >
                    Online
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex w-full flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-3">
                {toneOptions.map((option) => (
                  <button
                    key={option.tone}
                    type="button"
                    onClick={() => handleToneChange(option.tone)}
                    className={`rounded-full border px-4 py-1 text-sm transition ${
                      state.tone === option.tone
                        ? "border-cyan-300/80 bg-cyan-500/30 text-cyan-50"
                        : "border-cyan-300/30 text-cyan-200/80 hover:bg-cyan-500/10"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-cyan-200/70">
                Always-listening {state.alwaysListening ? "enabled" : "disabled"}
              </p>
            </div>
          </div>
        </section>

        <section className="flex h-full flex-col gap-6 rounded-3xl border border-cyan-500/30 bg-slate-950/70 p-6 shadow-[0_0_180px_rgba(14,116,144,0.25)] backdrop-blur-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-cyan-100">Dialogue Feed</h2>
              <p className="text-sm text-cyan-200/70">Jarvis remembers locally with encryption.</p>
            </div>
            <button
              type="button"
              onClick={clearHistory}
              className="flex items-center gap-2 rounded-full border border-cyan-500/30 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100 transition hover:bg-cyan-500/10"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reset Memory
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-cyan-400/10 bg-slate-950/40 p-4">
              {history.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-cyan-200/60">
                  <Sparkles className="h-5 w-5" />
                  <p>Say “Hey Jarvis” or type to begin. Memory is stored locally with AES-256.</p>
                </div>
              )}
              {history.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${
                    message.role === "assistant" ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                      message.role === "assistant"
                        ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-50"
                        : "border-indigo-500/30 bg-indigo-500/10 text-indigo-50"
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed">{message.content}</p>
                    <span className="mt-2 inline-block text-[10px] uppercase tracking-[0.3em] text-cyan-200/60">
                      {message.role === "assistant" ? "Jarvis" : "You"}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            <AnimatePresence>
              {automationResult && (
                <motion.div
                  key="automation"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-4 text-sm text-cyan-100"
                >
                  <p className="font-semibold uppercase tracking-[0.3em] text-[10px] text-cyan-200/80">
                    Automation
                  </p>
                  <p className="mt-2 leading-relaxed">{automationResult.details}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {suggestions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/60">
                  Frequent automations
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleSubmit(suggestion.command)}
                      className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form
              className={`flex items-center gap-3 rounded-2xl border border-cyan-400/30 bg-slate-950/60 p-3 shadow-[0_0_30px_rgba(14,165,233,0.15)] ${
                focused ? "ring-2 ring-cyan-400/60" : "ring-1 ring-cyan-400/10"
              }`}
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit(input);
              }}
            >
              <input
                className="flex-1 bg-transparent text-sm text-cyan-50 outline-none placeholder:text-cyan-300/40"
                placeholder="Type a request or automation command..."
                value={input}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onChange={(event) => setInput(event.target.value)}
              />
              <button
                type="submit"
                disabled={pending}
                className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Processing
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> Send
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}

export default JarvisApp;
