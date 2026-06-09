import { z } from "zod";

export { loadSoul } from "./soul.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";
const DAILY_CAP = 30;

const ChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          role: z.literal("assistant"),
          content: z.string().nullable(),
        }),
      }),
    )
    .min(1),
});

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
}

export class RateLimitError extends Error {
  constructor(public readonly cap: number) {
    super(`LLM call cap reached for this session (${cap}). Fall back to template path.`);
    this.name = "RateLimitError";
  }
}

let callsUsed = 0;

export function callsRemaining(): number {
  return Math.max(0, DAILY_CAP - callsUsed);
}

/** Ensure OpenAI-compatible base URL ends with /v1 (not /chat/completions). */
function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.replace(/\/+$/, "");
  if (trimmed.endsWith("/v1")) return trimmed;
  // Bare host roots (e.g. https://llm-router.example.com) need /v1
  if (!trimmed.includes("/v1")) return `${trimmed}/v1`;
  return trimmed;
}

/** Parse OpenAI chat completion — plain JSON or SSE (some routers append data: lines). */
function parseCompletionBody(raw: string): unknown {
  const text = raw.trim();
  if (text.startsWith("data:")) {
    let content = "";
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const chunk = JSON.parse(payload) as {
        choices?: Array<{
          delta?: { content?: string };
          message?: { content?: string };
        }>;
      };
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) content += delta;
      const msg = chunk.choices?.[0]?.message?.content;
      if (msg) content = msg;
    }
    if (!content) throw new Error("LLM SSE stream returned no content");
    return { choices: [{ message: { role: "assistant", content } }] };
  }

  const jsonPart = text.includes("\ndata:")
    ? text.slice(0, text.indexOf("\ndata:")).trim()
    : text;
  return JSON.parse(jsonPart);
}

export async function chat(
  messages: ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  if (callsUsed >= DAILY_CAP) throw new RateLimitError(DAILY_CAP);

  const baseUrl = normalizeBaseUrl(process.env.LLM_BASE_URL ?? DEFAULT_BASE_URL);
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error(
      "LLM_API_KEY not set. Copy .env.example to .env and fill in your key.",
    );
  }

  callsUsed += 1;

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 600,
    stream: false,
  };
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  if (res.status === 429) throw new RateLimitError(DAILY_CAP);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const hint =
      res.status === 404 && detail.startsWith("<!")
        ? " — check LLM_BASE_URL ends with /v1 (e.g. https://host/v1)"
        : "";
    throw new Error(`LLM ${res.status}${hint}: ${detail.slice(0, 200)}`);
  }

  const bodyText = await res.text();
  const parsed = ChatResponseSchema.parse(parseCompletionBody(bodyText));
  const content = parsed.choices[0]?.message.content;
  if (!content) throw new Error("LLM returned empty content");
  return content;
}

export async function chatJson<O>(
  messages: ChatMessage[],
  schema: z.ZodType<O, z.ZodTypeDef, unknown>,
  opts: Omit<ChatOptions, "responseFormat"> = {},
): Promise<O> {
  const raw = await chat(messages, { ...opts, responseFormat: "json_object" });
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`LLM did not return JSON: ${raw.slice(0, 200)}`);
  }
  return schema.parse(data);
}
