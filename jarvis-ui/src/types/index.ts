export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  tone?: VoiceTone;
}

export type VoiceTone = "cheerful" | "calm" | "serious" | "neutral";

export interface ActionSuggestion {
  id: string;
  label: string;
  description: string;
  command: string;
  frequency: number;
}

export interface AutomationResult {
  command: string;
  status: "success" | "failed" | "unsupported";
  details: string;
}

export interface AssistantState {
  listening: boolean;
  speaking: boolean;
  wakeWord: string;
  tone: VoiceTone;
  personality: "caring" | "witty" | "confident";
  alwaysListening: boolean;
}
