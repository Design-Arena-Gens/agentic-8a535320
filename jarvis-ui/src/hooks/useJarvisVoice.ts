import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceTone } from "@/types";

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  item: (index: number) => SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => void;
}

type SpeechRecognition = BrowserSpeechRecognition;
type SpeechRecognitionCtor = new () => SpeechRecognition;

declare global {
  interface Window {
    webkitSpeechRecognition: SpeechRecognitionCtor;
    SpeechRecognition: SpeechRecognitionCtor;
  }
}

interface UseJarvisVoiceOptions {
  wakeWord: string;
  tone: VoiceTone;
  alwaysListening: boolean;
  onWake?: () => void;
  onFinalTranscript?: (transcript: string) => void;
}

interface SpeakOptions {
  text: string;
  tone?: VoiceTone;
}

const DEFAULT_SAMPLE_RATE = 2048;

export function useJarvisVoice({
  wakeWord,
  tone,
  alwaysListening,
  onWake,
  onFinalTranscript,
}: UseJarvisVoiceOptions) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const cleanupAnalyser = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const setupAnalyser = useCallback(async () => {
    try {
      if (analyserRef.current) {
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const context = new AudioContext();
      audioContextRef.current = context;
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = DEFAULT_SAMPLE_RATE;
      source.connect(analyser);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((acc, value) => acc + value, 0);
        const avg = sum / data.length;
        setAudioLevel(Math.min(1, avg / 180));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    } catch (error) {
      console.warn("Unable to initialise microphone analyser", error);
    }
  }, []);

  const ensureRecognition = useCallback(() => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }
    if (typeof window === "undefined") {
      return null;
    }
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      return null;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;
    return recognition;
  }, []);

  useEffect(() => {
    const recognition = ensureRecognition();
    if (!recognition) {
      return;
    }

    const handleResult = (event: Event) => {
      const speechEvent = event as SpeechRecognitionEvent;
      let transcript = "";
      for (let i = speechEvent.resultIndex; i < speechEvent.results.length; i += 1) {
        transcript += speechEvent.results[i][0].transcript;
        if (speechEvent.results[i].isFinal) {
          const final = speechEvent.results[i][0].transcript.trim();
          setLastTranscript(final);
          onFinalTranscript?.(final);
          if (final.toLowerCase().includes(wakeWord.toLowerCase())) {
            onWake?.();
          }
        }
      }
      if (transcript) {
        setLastTranscript(transcript.trim());
      }
    };

    const handleEnd = () => {
      setListening(false);
      if (alwaysListening && !muted) {
        recognition.start();
        setListening(true);
      }
    };

    recognition.addEventListener("result", handleResult);
    recognition.addEventListener("end", handleEnd);

    return () => {
      recognition.removeEventListener("result", handleResult);
      recognition.removeEventListener("end", handleEnd);
    };
  }, [ensureRecognition, alwaysListening, muted, onFinalTranscript, onWake, wakeWord]);

  const startListening = useCallback(async () => {
    if (muted) {
      return;
    }
    const recognition = ensureRecognition();
    if (!recognition) {
      return;
    }
    try {
      recognition.start();
      setListening(true);
      await setupAnalyser();
    } catch (error) {
      console.warn("Speech recognition start failed", error);
    }
  }, [ensureRecognition, muted, setupAnalyser]);

  const stopListening = useCallback(() => {
    const recognition = ensureRecognition();
    recognition?.stop();
    setListening(false);
    cleanupAnalyser();
  }, [cleanupAnalyser, ensureRecognition]);

  const speak = useCallback(
    async ({ text, tone: toneOverride }: SpeakOptions) => {
      if (!text.trim()) {
        return;
      }
      setSpeaking(true);
      try {
        const response = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            tone: toneOverride ?? tone,
          }),
        });

        if (response.ok) {
          const { audio } = await response.json();
          if (audio) {
            const audioBuffer = Uint8Array.from(atob(audio), (char) =>
              char.charCodeAt(0),
            );
            const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
            const url = URL.createObjectURL(blob);
            const audioElement = new Audio(url);
            await audioElement.play();
            audioElement.onended = () => {
              URL.revokeObjectURL(url);
            };
            setSpeaking(false);
            return;
          }
        }

        if ("speechSynthesis" in window) {
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.pitch = tone === "cheerful" ? 1.2 : tone === "serious" ? 0.8 : 1;
          utterance.rate = 1;
          const voices = window.speechSynthesis.getVoices();
          const femaleVoice =
            voices.find((voice) => voice.name.toLowerCase().includes("female")) ||
            voices[0];
          if (femaleVoice) {
            utterance.voice = femaleVoice;
          }
          utterance.onend = () => setSpeaking(false);
          window.speechSynthesis.speak(utterance);
          return;
        }
      } catch (error) {
        console.warn("Failed to speak via ElevenLabs, falling back", error);
      }
      setSpeaking(false);
    },
    [tone],
  );

  useEffect(() => {
    if (!(alwaysListening && !listening && !muted)) {
      return;
    }
    const timer = window.setTimeout(() => {
      void startListening();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [alwaysListening, listening, muted, startListening]);

  useEffect(() => {
    return () => {
      stopListening();
      cleanupAnalyser();
    };
  }, [cleanupAnalyser, stopListening]);

  return {
    listening,
    speaking,
    muted,
    lastTranscript,
    audioLevel,
    startListening,
    stopListening,
    setMuted,
    speak,
  };
}
