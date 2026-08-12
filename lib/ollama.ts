export const DEFAULT_BASE_URL = "http://localhost:11434";

export type OllamaChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OllamaModel = {
  name: string;
  model: string;
  size: number;
  digest: string;
  modified_at: string;
};

export function normalizeBaseUrl(url: string): string {
  return (url || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export class OllamaError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(init?.body ? 120_000 : 15_000),
    });
  } catch (err) {
    throw new OllamaError(
      `Cannot reach Ollama at ${new URL(url).origin}. Is it running?`,
      502
    );
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OllamaError(
      `Ollama responded ${res.status}${text ? `: ${text.slice(0, 300)}` : ""}`,
      res.status >= 500 ? 502 : 502
    );
  }
  return (await res.json()) as T;
}

export async function ping(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${normalizeBaseUrl(baseUrl)}/`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels(baseUrl: string): Promise<OllamaModel[]> {
  const data = await fetchJson<{ models: OllamaModel[] }>(
    `${normalizeBaseUrl(baseUrl)}/api/tags`
  );
  return data.models ?? [];
}

export type ChatStreamChunk = {
  delta?: string;
  usage?: { input: number; output: number };
};

/**
 * Stream a chat completion from Ollama. Yields deltas as they arrive, plus a
 * final usage chunk carrying prompt/eval token counts.
 * Throws an OllamaError if the connection fails or the model errors out.
 */
export async function* chatStream(
  baseUrl: string,
  model: string,
  messages: OllamaChatMessage[],
  options?: { num_ctx?: number; temperature?: number }
): AsyncGenerator<ChatStreamChunk> {
  const url = `${normalizeBaseUrl(baseUrl)}/api/chat`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options,
      }),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new OllamaError(
      `Cannot reach Ollama at ${normalizeBaseUrl(baseUrl)}. Is it running?`,
      502
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new OllamaError(
      text
        ? `Ollama: ${text.slice(0, 400)}`
        : `Ollama returned HTTP ${res.status}`,
      502
    );
  }

  if (!res.body) throw new OllamaError("Ollama returned an empty stream", 502);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let json: any;
        try {
          json = JSON.parse(line);
        } catch {
          continue;
        }
        if (json.error) throw new OllamaError(String(json.error), 502);
        const delta: string = json.message?.content ?? "";
        if (delta) yield { delta };
        if (json.done) {
          yield {
            usage: {
              input: json.prompt_eval_count ?? 0,
              output: json.eval_count ?? 0,
            },
          };
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
