export interface TelegramSendResult {
  messageId: number;
  chatId: string;
}

export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() ?? null;
}

export function getTelegramConfig(): { botToken: string; chatId: string } | null {
  const botToken = getBotToken();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

async function tgApi<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const botToken = getBotToken();
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!data.ok) {
    throw new Error(`Telegram ${method}: ${data.description ?? res.status}`);
  }
  return data.result as T;
}

export async function sendTelegramMessage(
  text: string,
  opts?: { botToken?: string; chatId?: string },
): Promise<TelegramSendResult> {
  const chatId = opts?.chatId ?? process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) throw new Error("chatId required");

  const chunks = splitMessage(text, 4000);
  let last: TelegramSendResult | null = null;

  for (const chunk of chunks) {
    const result = await tgApi<{
      message_id: number;
      chat: { id: number };
    }>("sendMessage", {
      chat_id: chatId,
      text: chunk,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    last = { messageId: result.message_id, chatId: String(result.chat.id) };
  }

  return last!;
}

function splitMessage(text: string, max: number): string[] {
  if (text.length <= max) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > max) {
    parts.push(rest.slice(0, max));
    rest = rest.slice(max);
  }
  if (rest) parts.push(rest);
  return parts;
}

export async function registerTelegramWebhook(publicBaseUrl: string): Promise<void> {
  const url = `${publicBaseUrl.replace(/\/$/, "")}/webhook/telegram`;
  await tgApi<boolean>("setWebhook", { url, allowed_updates: ["message"] });
  process.stdout.write(`[telegram] webhook registered → ${url}\n`);
}

export async function deleteTelegramWebhook(): Promise<void> {
  await tgApi<boolean>("deleteWebhook", {});
}
