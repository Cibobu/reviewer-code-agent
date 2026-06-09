import type { ResearchOutput } from "@foru-workshop/contracts/src/research.js";

const RISK_EMOJI: Record<string, string> = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  critical: "🔴",
};

function bulletList(items: string[], empty = "—"): string {
  if (!items.length) return empty;
  return items.map((i) => `• ${i}`).join("\n");
}

export interface FormatContext {
  scanType: "pr" | "branch_compare";
  link: string;
  webhookMeta?: {
    repository: string;
    action: string;
    prNumber?: number;
    branch?: string;
  };
  branchMeta?: {
    repository: string;
    base: string;
    head: string;
    aheadBy: number;
    behindBy: number;
  };
}

/** Format review report for Telegram (HTML). */
export function formatReviewForTelegram(
  review: ResearchOutput,
  ctx: FormatContext,
): string {
  const emoji = RISK_EMOJI[review.riskLevel] ?? "⚪";

  let header: string;
  if (ctx.scanType === "branch_compare" && ctx.branchMeta) {
    header =
      `<b>Branch Review</b> · ${escapeHtml(ctx.branchMeta.repository)}\n` +
      `<code>${escapeHtml(ctx.branchMeta.head)}</code> → <code>${escapeHtml(ctx.branchMeta.base)}</code>\n` +
      `${ctx.branchMeta.aheadBy} ahead · ${ctx.branchMeta.behindBy} behind`;
  } else if (ctx.webhookMeta) {
    header =
      `<b>PR #${ctx.webhookMeta.prNumber ?? "?"}</b> · ${escapeHtml(ctx.webhookMeta.repository)}` +
      (ctx.webhookMeta.branch
        ? `\nBranch: <code>${escapeHtml(ctx.webhookMeta.branch)}</code>`
        : "") +
      `\n<code>${escapeHtml(ctx.webhookMeta.action)}</code>`;
  } else {
    header = ctx.scanType === "branch_compare" ? "<b>Branch Compare Scan</b>" : "<b>PR Scan</b>";
  }

  const parts = [
    `${emoji} <b>Risk: ${review.riskLevel.toUpperCase()}</b>`,
    header,
    `<a href="${escapeAttr(ctx.link)}">${escapeHtml(ctx.link)}</a>`,
    "",
    `<b>Summary</b>`,
    escapeHtml(review.summary),
    "",
    `<b>Merge / compare status</b>`,
    escapeHtml(review.mergeStatus),
    "",
    `<b>Issues</b>`,
    escapeHtml(bulletList(review.issuesFound)),
    "",
    `<b>Security</b>`,
    escapeHtml(bulletList(review.securityNotes)),
    "",
    `<b>Missing tests</b>`,
    escapeHtml(bulletList(review.missingTests)),
    "",
    `<b>Effect if merged</b>`,
    escapeHtml(review.effectIfMerged),
    "",
    `<b>Recommended next action</b>`,
    escapeHtml(review.recommendedNextAction),
  ];

  let text = parts.join("\n");
  if (text.length > 4000) text = text.slice(0, 3990) + "\n…(truncated)";
  return text;
}

export function formatSetupWebhookInstructions(opts: {
  webhookUrl: string;
  secret: string;
  repository: string;
}): string {
  return [
    "<b>🔗 Langkah terakhir — pasang Webhook GitHub</b>",
    "",
    "1. Buka repo di GitHub → <b>Settings</b> → <b>Webhooks</b> → <b>Add webhook</b>",
    "2. Isi form:",
    `   • <b>Payload URL:</b>\n<code>${escapeHtml(opts.webhookUrl)}</code>`,
    "   • <b>Content type:</b> application/json",
    `   • <b>Secret:</b>\n<code>${escapeHtml(opts.secret)}</code>`,
    "   • <b>Events:</b> Pull requests + Pushes",
    "3. Klik <b>Add webhook</b>",
    "",
    `Repo: <code>${escapeHtml(opts.repository)}</code>`,
    "",
    "Setelah webhook aktif (✓ hijau), ketik /selesai",
  ].join("\n");
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;").replace(/&/g, "&amp;");
}
