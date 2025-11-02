import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/types";
import { decryptPayload, encryptPayload } from "@/lib/encryption";

const STORAGE_KEY = "jarvis.chat.vault";
const MAX_MESSAGES = 100;

export function usePersistentChat() {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const isHydrated = useRef(false);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          isHydrated.current = true;
          setHydrated(true);
          return;
        }
        const decrypted = await decryptPayload(stored);
        if (!decrypted) {
          isHydrated.current = true;
          setHydrated(true);
          return;
        }
        const parsed = JSON.parse(decrypted) as ChatMessage[];
        if (active) {
          setHistory(parsed);
          isHydrated.current = true;
          setHydrated(true);
        }
      } catch (error) {
        console.warn("Failed to hydrate chat history", error);
        isHydrated.current = true;
        setHydrated(true);
      }
    };

    hydrate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated.current) {
      return;
    }

    let cancelled = false;

    const persist = async () => {
      try {
        const payload = JSON.stringify(history);
        const encrypted = await encryptPayload(payload);
        if (!cancelled) {
          localStorage.setItem(STORAGE_KEY, encrypted);
        }
      } catch (error) {
        console.warn("Failed to persist chat history", error);
      }
    };

    persist();

    return () => {
      cancelled = true;
    };
  }, [history]);

  const addMessage = useCallback((message: ChatMessage) => {
    setHistory((prev) => {
      const next = [...prev, message].slice(-MAX_MESSAGES);
      return next;
    });
  }, []);

  const replaceHistory = useCallback((messages: ChatMessage[]) => {
    setHistory(messages.slice(-MAX_MESSAGES));
    isHydrated.current = true;
    setHydrated(true);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    history,
    addMessage,
    replaceHistory,
    clearHistory,
    hydrated,
  };
}
