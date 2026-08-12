export type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: "streaming" | "error";
  error?: string;
};

export type UiFile = {
  id: string;
  name: string;
  size: number;
  strategy: "embed" | "fulltext";
  preview: string;
};

export type UiSession = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: UiMessage[];
  files: UiFile[];
};

export type SessionSummary = {
  id: string;
  name: string;
  updatedAt: string;
  messageCount: number;
  fileCount: number;
  preview: string;
};

export type Settings = {
  baseUrl: string;
  embedModel: string;
  theme: "dark" | "light";
};

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: "http://localhost:11434",
  embedModel: "nomic-embed-text",
  theme: "dark",
};
