/** Trim and strip spaces from pasted Chat IDs. */
export function normalizeChatId(raw: string): string {
  return raw.trim().replace(/\s/g, "");
}

/** Telegram accepts numeric chat_id for users/groups. */
export function chatIdForApi(chatId: string): string | number {
  const normalized = normalizeChatId(chatId);
  if (/^-?\d+$/.test(normalized)) return Number(normalized);
  return normalized;
}

export function isValidChatIdFormat(chatId: string): boolean {
  const n = normalizeChatId(chatId);
  return /^-?\d+$/.test(n) || /^@[a-zA-Z0-9_]{5,}$/.test(n);
}

/** Escape dynamic text for Telegram HTML parse_mode. */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
