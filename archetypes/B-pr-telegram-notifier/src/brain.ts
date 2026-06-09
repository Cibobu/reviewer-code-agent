// ============================================================================
// ARCHETYPE B — TELEGRAM REVIEW BOT
// PR + branch compare reviews → Telegram
// ============================================================================

import type { Input, Output } from "./contract.js";
import { formatReviewForTelegram } from "./format.js";
import { runReview } from "./review-engine.js";
import { sendTelegramMessage } from "./telegram.js";

export async function brain(input: Input): Promise<Output> {
  const result = await runReview(input);

  const messageText = formatReviewForTelegram(result.review, {
    scanType: result.scanType,
    link: result.link,
    webhookMeta: input.webhook
      ? {
          repository: input.webhook.repository,
          action: input.webhook.action,
          prNumber: input.webhook.prNumber,
          branch: input.webhook.branch,
        }
      : undefined,
    branchMeta:
      result.branchPayload
        ? {
            repository: `${result.branchPayload.owner}/${result.branchPayload.repo}`,
            base: result.branchPayload.base,
            head: result.branchPayload.head,
            aheadBy: result.branchPayload.aheadBy,
            behindBy: result.branchPayload.behindBy,
          }
        : undefined,
  });

  const dryRun = input.dryRun === true;
  const chatId = input.telegramChatId ?? process.env.TELEGRAM_CHAT_ID?.trim();

  if (dryRun || !chatId) {
    return {
      delivered: false,
      chatId: chatId ?? "(not configured)",
      messageText,
      skippedReason: dryRun
        ? "dryRun=true — Telegram skipped"
        : "telegramChatId not set",
      scanType: result.scanType,
      review: result.review,
    };
  }

  const sent = await sendTelegramMessage(messageText, { chatId });
  return {
    delivered: true,
    chatId: sent.chatId,
    messageText,
    telegramMessageId: sent.messageId,
    scanType: result.scanType,
    review: result.review,
  };
}
