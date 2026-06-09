import { escapeTelegramHtml } from "./telegram.js";

export type TelegramDiffFile = {
  filename: string;
  status: string;
  patch?: string;
};

export type TelegramFinding = {
  severity: string;
  title: string;
  filePath?: string;
  lineHint?: string;
  category?: string;
};

export type TelegramReviewMessageInput = {
  repo: string;
  eventType: string;
  title: string;
  author?: string;
  baseBranch?: string;
  headBranch?: string;
  severity: string;
  score: number;
  summary: string;
  files: TelegramDiffFile[];
  findings: TelegramFinding[];
  mustFix: string[];
  recommended: string[];
  reviewUrl: string;
};

const EVENT_ICONS: Record<string, string> = {
  pull_request: "🔀",
  push: "📤",
  create: "🌿",
  delete: "🗑️",
  issues: "📋",
};

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

export function summarizeFileChanges(files: TelegramDiffFile[]) {
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];
  const renamed: string[] = [];

  for (const f of files) {
    const name = f.filename;
    switch (f.status) {
      case "added":
        added.push(name);
        break;
      case "removed":
        removed.push(name);
        break;
      case "renamed":
        renamed.push(name);
        break;
      default:
        modified.push(name);
    }
  }
  return { added, modified, removed, renamed };
}

/** Extract function/const/class symbols from diff hunks. */
export function extractSymbolsFromFiles(files: TelegramDiffFile[]) {
  const added: string[] = [];
  const removed: string[] = [];

  for (const file of files) {
    const patch = file.patch ?? "";
    const short = basename(file.filename);
    for (const line of patch.split("\n")) {
      const addFn = line.match(/^\+(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (addFn) added.push(`${addFn[1]}() · ${short}`);

      const remFn = line.match(/^-(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (remFn) removed.push(`${remFn[1]}() · ${short}`);

      const addConst = line.match(/^\+export\s+const\s+(\w+)/);
      if (addConst) added.push(`${addConst[1]} · ${short}`);

      const remConst = line.match(/^-export\s+const\s+(\w+)/);
      if (remConst) removed.push(`${remConst[1]} · ${short}`);

      const addClass = line.match(/^\+(?:export\s+)?class\s+(\w+)/);
      if (addClass) added.push(`${addClass[1]} · ${short}`);

      const remClass = line.match(/^-(?:export\s+)?class\s+(\w+)/);
      if (remClass) removed.push(`${remClass[1]} · ${short}`);
    }
  }

  return {
    added: [...new Set(added)],
    removed: [...new Set(removed)],
  };
}

function bulletList(items: string[], max: number): { text: string; hidden: number } {
  if (!items.length) return { text: "", hidden: 0 };
  const shown = items.slice(0, max);
  const hidden = Math.max(0, items.length - max);
  const lines = shown.map((item) => `  • ${escapeTelegramHtml(item)}`).join("\n");
  const suffix = hidden > 0 ? `\n  … +${hidden} more` : "";
  return { text: lines + suffix, hidden };
}

function section(title: string, body: string): string {
  if (!body.trim()) return "";
  return `\n<b>${title}</b>\n${body}`;
}

const TELEGRAM_MAX = 4096;

export function formatReviewTelegramMessage(input: TelegramReviewMessageInput): string {
  const icon = EVENT_ICONS[input.eventType] ?? "📌";
  const sevIcon =
    input.severity === "CRITICAL" ? "🚨" : input.severity === "HIGH" ? "⚠️" : "ℹ️";

  const repo = escapeTelegramHtml(input.repo);
  const title = escapeTelegramHtml(input.title);
  const author = input.author ? escapeTelegramHtml(input.author) : "";
  const severity = escapeTelegramHtml(input.severity);
  const summary = escapeTelegramHtml(input.summary.slice(0, 350));

  const branches =
    input.headBranch && input.baseBranch
      ? escapeTelegramHtml(`${input.headBranch} → ${input.baseBranch}`)
      : input.headBranch
        ? escapeTelegramHtml(input.headBranch)
        : "";

  const changes = summarizeFileChanges(input.files);
  const symbols = extractSymbolsFromFiles(input.files);

  const fileLines: string[] = [];
  const pushGroup = (label: string, emoji: string, items: string[]) => {
    if (!items.length) return;
    const { text } = bulletList(items.map((f) => basename(f)), 6);
    fileLines.push(`${emoji} <b>${label} (${items.length})</b>\n${text}`);
  };
  pushGroup("Added", "➕", changes.added);
  pushGroup("Modified", "✏️", changes.modified);
  pushGroup("Removed", "➖", changes.removed);
  pushGroup("Renamed", "↪️", changes.renamed);

  const symbolLines: string[] = [];
  if (symbols.added.length) {
    const { text } = bulletList(symbols.added, 8);
    symbolLines.push(`➕ <b>Added</b>\n${text}`);
  }
  if (symbols.removed.length) {
    const { text } = bulletList(symbols.removed, 8);
    symbolLines.push(`➖ <b>Removed</b>\n${text}`);
  }
  if (changes.modified.length && !symbols.added.length && !symbols.removed.length) {
    const { text } = bulletList(
      changes.modified.map((f) => `${basename(f)} (modified)`),
      6,
    );
    symbolLines.push(`✏️ <b>Changed</b>\n${text}`);
  }

  const findingLines = input.findings.slice(0, 8).map((f) => {
    const loc = f.filePath
      ? `${basename(f.filePath)}${f.lineHint ? `:${f.lineHint}` : ""}`
      : "";
    const label = [f.severity, f.title, loc].filter(Boolean).join(" — ");
    return `  • ${escapeTelegramHtml(label)}`;
  });
  const findingsHidden = Math.max(0, input.findings.length - 8);
  const findingsBlock = findingLines.length
    ? findingLines.join("\n") + (findingsHidden ? `\n  … +${findingsHidden} more` : "")
    : "  • No rule-based findings";

  const mustFixBlock = bulletList(input.mustFix, 6).text;
  const recommendedBlock = bulletList(input.recommended, 4).text;

  const parts = [
    `${icon}${sevIcon} <b>GitGuardian Review</b> · <b>${severity}</b>`,
    "",
    `📦 <code>${repo}</code>`,
    `📋 ${title}`,
    author ? `👤 ${author}` : "",
    branches ? `🌿 ${branches}` : "",
    `📊 Score: <code>${input.score}/100</code>`,
    section("Summary", summary),
    fileLines.length ? section("File changes", fileLines.join("\n\n")) : "",
    symbolLines.length ? section("Functions / symbols", symbolLines.join("\n\n")) : "",
    section("Security findings", findingsBlock),
    mustFixBlock ? section("Must fix", mustFixBlock) : "",
    recommendedBlock ? section("Recommended", recommendedBlock) : "",
    "",
    `<a href="${input.reviewUrl}">View full review →</a>`,
  ].filter(Boolean);

  let message = parts.join("\n");
  if (message.length > TELEGRAM_MAX) {
    message = `${message.slice(0, TELEGRAM_MAX - 40)}\n\n… (truncated)\n<a href="${input.reviewUrl}">View full review →</a>`;
  }
  return message;
}
