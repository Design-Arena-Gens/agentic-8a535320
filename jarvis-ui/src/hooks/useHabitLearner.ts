import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActionSuggestion, ChatMessage } from "@/types";

interface HabitSnapshot {
  command: string;
  label: string;
  description: string;
  frequency: number;
}

const HABIT_STORAGE = "jarvis.habits";
const MAX_SUGGESTIONS = 6;

function normaliseCommand(command: string): string {
  return command.trim().toLowerCase();
}

function detectCommand(message: ChatMessage): HabitSnapshot | null {
  if (message.role !== "user") {
    return null;
  }
  const content = message.content.toLowerCase();

  if (content.startsWith("open ")) {
    const target = content.replace("open ", "").trim();
    return {
      command: `open ${target}`,
      label: `Open ${target}`,
      description: `Jarvis can launch ${target} for you.`,
      frequency: 1,
    };
  }
  if (content.includes("play") && content.includes("spotify")) {
    const target = content.split("play")[1]?.trim() ?? "Spotify";
    return {
      command: `play ${target}`,
      label: `Play ${target}`,
      description: "Stream your favourite music on Spotify.",
      frequency: 1,
    };
  }
  if (content.includes("email") || content.includes("gmail")) {
    return {
      command: "check gmail",
      label: "Check Gmail",
      description: "Review new emails via Gmail integration.",
      frequency: 1,
    };
  }
  if (content.includes("calendar") || content.includes("schedule")) {
    return {
      command: "review calendar",
      label: "Review Calendar",
      description: "Sync your agenda from Google Calendar.",
      frequency: 1,
    };
  }
  return null;
}

function loadStoredHabits(): HabitSnapshot[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const stored = localStorage.getItem(HABIT_STORAGE);
    if (!stored) {
      return [];
    }
    return JSON.parse(stored) as HabitSnapshot[];
  } catch (error) {
    console.warn("Failed to load habits", error);
    return [];
  }
}

function persistHabits(habits: HabitSnapshot[]) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(HABIT_STORAGE, JSON.stringify(habits));
  } catch (error) {
    console.warn("Failed to persist habits", error);
  }
}

export function useHabitLearner(history: ChatMessage[]) {
  const [version, setVersion] = useState(0);

  const suggestions = useMemo(() => {
    if (typeof window === "undefined") {
      return [] as ActionSuggestion[];
    }
    void version; // triggers recalculation when registerHabit increments version
    const merged = new Map<string, HabitSnapshot>();

    loadStoredHabits().forEach((snapshot) => {
      merged.set(normaliseCommand(snapshot.command), snapshot);
    });

    history.forEach((message) => {
      const detected = detectCommand(message);
      if (!detected) {
        return;
      }
      const key = normaliseCommand(detected.command);
      const current = merged.get(key);
      const frequency = (current?.frequency ?? 0) + 1;
      merged.set(key, { ...detected, frequency });
    });

    const sorted = Array.from(merged.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, MAX_SUGGESTIONS);

    return sorted.map<ActionSuggestion>((item) => ({
      ...item,
      id: normaliseCommand(item.command),
    }));
  }, [history, version]);

  useEffect(() => {
    if (suggestions.length === 0) {
      persistHabits([]);
      return;
    }
    persistHabits(
      suggestions.map((item) => ({
        command: item.command,
        description: item.description,
        label: item.label,
        frequency: item.frequency,
      })),
    );
  }, [suggestions]);

  const registerHabit = useCallback((snapshot: HabitSnapshot) => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = loadStoredHabits();
    const map = new Map(stored.map((item) => [normaliseCommand(item.command), item]));
    const key = normaliseCommand(snapshot.command);
    const existing = map.get(key);
    map.set(key, {
      command: snapshot.command,
      label: snapshot.label,
      description: snapshot.description,
      frequency: (existing?.frequency ?? 0) + snapshot.frequency,
    });
    const ordered = Array.from(map.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, MAX_SUGGESTIONS);
    persistHabits(ordered);
    setVersion((value) => value + 1);
  }, []);

  const clearHabits = useCallback(() => {
    persistHabits([]);
    setVersion((value) => value + 1);
  }, []);

  return { suggestions, registerHabit, clearHabits };
}
