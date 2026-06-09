import { handle } from "./handler.js";
import {
  formatSetupWebhookInstructions,
  escapeHtml,
} from "./format.js";
import { sendTelegramMessage } from "./telegram.js";
import {
  type ChatConfig,
  generateWebhookSecret,
  getOrCreateChat,
  isSetupComplete,
  repoFullName,
  saveChat,
} from "./store.js";

export interface TelegramUpdate {
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
  };
}

function publicBaseUrl(): string {
  const url = process.env.PUBLIC_BASE_URL?.trim();
  if (!url) throw new Error("PUBLIC_BASE_URL not configured on server");
  return url.replace(/\/$/, "");
}

function webhookUrlForChat(chatId: string): string {
  return `${publicBaseUrl()}/webhook/github/${chatId}`;
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;
  if (!msg?.text) return;

  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const config = await getOrCreateChat(chatId);

  if (text.startsWith("/")) {
    await handleCommand(chatId, text, config);
    return;
  }

  if (!isSetupComplete(config)) {
    await handleSetupInput(chatId, text, config);
    return;
  }

  await sendTelegramMessage(
    "Perintah tidak dikenali. Ketik /help untuk daftar perintah.",
    { chatId },
  );
}

async function handleCommand(
  chatId: string,
  text: string,
  config: ChatConfig,
): Promise<void> {
  const [cmdRaw, ...args] = text.split(/\s+/);
  const cmd = cmdRaw ?? "";
  const command = cmd.split("@")[0]?.toLowerCase() ?? "";

  switch (command) {
    case "/start":
      await cmdStart(chatId, config);
      break;
    case "/setup":
      await cmdSetup(chatId, config);
      break;
    case "/selesai":
    case "/done":
      await cmdFinishSetup(chatId, config);
      break;
    case "/status":
      await cmdStatus(chatId, config);
      break;
    case "/help":
      await cmdHelp(chatId, config);
      break;
    case "/compare":
      await cmdCompare(chatId, config, args);
      break;
    case "/scan":
      await cmdScan(chatId, config, args.join(" "));
      break;
    default:
      await sendTelegramMessage(`Perintah ${escapeHtml(command)} tidak dikenali. /help`, {
        chatId,
      });
  }
}

async function cmdStart(chatId: string, config: ChatConfig): Promise<void> {
  config.setupStep = "welcome";
  await saveChat(config);
  await sendTelegramMessage(
    [
      "<b>👋 PR Review Bot</b>",
      "",
      "Bot ini otomatis review:",
      "• <b>Pull Request</b> GitHub (via webhook)",
      "• <b>Perbandingan branch</b> (branch A → branch B)",
      "",
      "Review menggunakan engine yang sama dengan Agent A.",
      "",
      "Ketik /setup untuk mulai konfigurasi GitHub + webhook.",
      "Ketik /help untuk bantuan.",
    ].join("\n"),
    { chatId },
  );
  await cmdSetup(chatId, config);
}

async function cmdSetup(chatId: string, config: ChatConfig): Promise<void> {
  config.setupStep = "repo";
  config.owner = undefined;
  config.repo = undefined;
  config.githubToken = undefined;
  config.webhookSecret = generateWebhookSecret();
  await saveChat(config);
  await sendTelegramMessage(
    [
      "<b>⚙️ Setup GitHub</b> (langkah 1/4)",
      "",
      "Kirim nama repo dalam format:",
      "<code>owner/repo</code>",
      "",
      "Contoh: <code>facebook/react</code>",
    ].join("\n"),
    { chatId },
  );
}

async function handleSetupInput(
  chatId: string,
  text: string,
  config: ChatConfig,
): Promise<void> {
  switch (config.setupStep) {
    case "repo": {
      const m = text.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
      if (!m) {
        await sendTelegramMessage(
          "Format salah. Kirim <code>owner/repo</code> contoh: <code>myorg/myapp</code>",
          { chatId },
        );
        return;
      }
      config.owner = m[1];
      config.repo = m[2];
      config.setupStep = "token";
      await saveChat(config);
      await sendTelegramMessage(
        [
          "<b>Langkah 2/4 — GitHub Token</b>",
          "",
          "Kirim Personal Access Token (PAT) dengan scope <code>repo</code> (untuk repo private).",
          "",
          "⚠️ Hapus pesan token setelah setup selesai demi keamanan.",
        ].join("\n"),
        { chatId },
      );
      break;
    }
    case "token": {
      if (!text.startsWith("ghp_") && !text.startsWith("github_pat_")) {
        await sendTelegramMessage(
          "Token tidak valid. PAT biasanya diawali <code>ghp_</code> atau <code>github_pat_</code>",
          { chatId },
        );
        return;
      }
      config.githubToken = text.trim();
      config.setupStep = "base_branch";
      await saveChat(config);
      await sendTelegramMessage(
        [
          "<b>Langkah 3/4 — Branch target</b>",
          "",
          "Kirim nama branch <b>target merge</b> (branch B / base).",
          "Push & compare akan diukur terhadap branch ini.",
          "",
          "Contoh: <code>main</code> atau <code>develop</code>",
          "",
          `(default saat ini: <code>${escapeHtml(config.defaultBaseBranch)}</code> — kirim nama branch atau ketik <code>skip</code>)`,
        ].join("\n"),
        { chatId },
      );
      break;
    }
    case "base_branch": {
      if (text.toLowerCase() !== "skip") {
        config.defaultBaseBranch = text.trim();
      }
      config.setupStep = "webhook";
      if (!config.webhookSecret) config.webhookSecret = generateWebhookSecret();
      await saveChat(config);
      await sendWebhookInstructions(chatId, config);
      break;
    }
    default:
      await sendTelegramMessage("Ketik /setup untuk mulai ulang.", { chatId });
  }
}

async function sendWebhookInstructions(
  chatId: string,
  config: ChatConfig,
): Promise<void> {
  const repo = repoFullName(config) ?? "owner/repo";
  await sendTelegramMessage(
    formatSetupWebhookInstructions({
      webhookUrl: webhookUrlForChat(chatId),
      secret: config.webhookSecret!,
      repository: repo,
    }),
    { chatId },
  );
}

async function cmdFinishSetup(chatId: string, config: ChatConfig): Promise<void> {
  if (!config.owner || !config.repo || !config.githubToken || !config.webhookSecret) {
    await sendTelegramMessage("Setup belum lengkap. Ketik /setup", { chatId });
    return;
  }
  config.setupStep = "ready";
  await saveChat(config);
  await sendTelegramMessage(
    [
      "<b>✅ Bot aktif!</b>",
      "",
      `Repo: <code>${escapeHtml(repoFullName(config)!)}</code>`,
      `Base branch: <code>${escapeHtml(config.defaultBaseBranch)}</code>`,
      "",
      "<b>Otomatis (webhook):</b>",
      "• PR baru / update → review dikirim ke chat ini",
      "• Push ke branch → compare vs base → review dikirim",
      "",
      "<b>Manual:</b>",
      "/compare feature-branch — compare ke base",
      "/compare feature main — compare eksplisit",
      "/scan https://github.com/.../pull/123",
      "",
      "/status · /help",
    ].join("\n"),
    { chatId },
  );
}

async function cmdStatus(chatId: string, config: ChatConfig): Promise<void> {
  const ready = isSetupComplete(config);
  await sendTelegramMessage(
    [
      `<b>Status:</b> ${ready ? "✅ Aktif" : "⏳ Setup belum selesai"}`,
      "",
      `Repo: ${config.owner && config.repo ? `<code>${config.owner}/${config.repo}</code>` : "—"}`,
      `Base branch: <code>${escapeHtml(config.defaultBaseBranch)}</code>`,
      `Token: ${config.githubToken ? "✓ tersimpan" : "✗ belum"}`,
      `Webhook secret: ${config.webhookSecret ? "✓" : "✗"}`,
      ready
        ? `\nWebhook URL:\n<code>${escapeHtml(webhookUrlForChat(chatId))}</code>`
        : "\nKetik /setup untuk melanjutkan.",
    ].join("\n"),
    { chatId },
  );
}

async function cmdHelp(chatId: string, _config: ChatConfig): Promise<void> {
  await sendTelegramMessage(
    [
      "<b>📖 Perintah</b>",
      "",
      "/start — mulai",
      "/setup — konfigurasi GitHub + webhook",
      "/selesai — selesaikan setup setelah webhook dipasang",
      "/status — cek konfigurasi",
      "/compare &lt;head&gt; [base] — review perbandingan branch",
      "/scan &lt;pr-url&gt; — review PR manual",
      "/help — bantuan ini",
    ].join("\n"),
    { chatId },
  );
}

async function cmdCompare(
  chatId: string,
  config: ChatConfig,
  args: string[],
): Promise<void> {
  if (!isSetupComplete(config)) {
    await sendTelegramMessage("Selesaikan /setup dulu.", { chatId });
    return;
  }
  const head = args[0];
  if (!head) {
    await sendTelegramMessage(
      "Usage: /compare &lt;head-branch&gt; [base-branch]\nContoh: /compare feature/payments main",
      { chatId },
    );
    return;
  }
  const base = args[1] ?? config.defaultBaseBranch;

  await sendTelegramMessage(
    `⏳ Menganalisis <code>${escapeHtml(head)}</code> → <code>${escapeHtml(base)}</code>…`,
    { chatId },
  );

  try {
    await handle({
      scanType: "branch_compare",
      branchCompare: {
        owner: config.owner!,
        repo: config.repo!,
        base,
        head,
      },
      githubToken: config.githubToken,
      telegramChatId: chatId,
    });
  } catch (err) {
    await sendTelegramMessage(
      `❌ Gagal: ${escapeHtml(err instanceof Error ? err.message : String(err))}`,
      { chatId },
    );
  }
}

async function cmdScan(
  chatId: string,
  config: ChatConfig,
  prUrl: string,
): Promise<void> {
  if (!prUrl) {
    await sendTelegramMessage(
      "Usage: /scan https://github.com/owner/repo/pull/123",
      { chatId },
    );
    return;
  }
  await sendTelegramMessage("⏳ Scanning PR…", { chatId });
  try {
    await handle({
      scanType: "pr",
      prUrl: prUrl.trim(),
      githubToken: config.githubToken,
      telegramChatId: chatId,
    });
  } catch (err) {
    await sendTelegramMessage(
      `❌ ${escapeHtml(err instanceof Error ? err.message : String(err))}`,
      { chatId },
    );
  }
}

/** Process GitHub webhook for a specific Telegram chat. */
export async function processGithubEventForChat(
  chatId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const { loadChat, isSetupComplete: ready } = await import("./store.js");
  const {
    parsePullRequestEvent,
    parsePushEvent,
    prUrlFromPayload,
    shouldProcessPrAction,
  } = await import("./github-webhook.js");

  const config = await loadChat(chatId);
  if (!config || !ready(config)) return;

  const token = config.githubToken;

  if (event === "pull_request") {
    const pr = parsePullRequestEvent(event, payload);
    if (!pr || !shouldProcessPrAction(pr.action)) return;
    if (pr.repository.full_name !== repoFullName(config)) return;

    await handle({
      scanType: "pr",
      prUrl: prUrlFromPayload(pr),
      githubToken: token,
      telegramChatId: chatId,
      webhook: {
        deliveryId: "gh",
        event,
        action: pr.action,
        repository: pr.repository.full_name,
        prNumber: pr.pull_request.number,
      },
    });
    return;
  }

  if (event === "push") {
    const push = parsePushEvent(event, payload);
    if (!push || push.repository.full_name !== repoFullName(config)) return;
    if (push.branch === config.defaultBaseBranch) return;

    await sendTelegramMessage(
      `🔔 Push ke <code>${escapeHtml(push.branch)}</code> — menganalisis vs <code>${escapeHtml(config.defaultBaseBranch)}</code>…`,
      { chatId },
    );

    await handle({
      scanType: "branch_compare",
      branchCompare: {
        owner: config.owner!,
        repo: config.repo!,
        base: config.defaultBaseBranch,
        head: push.branch,
      },
      githubToken: token,
      telegramChatId: chatId,
      webhook: {
        deliveryId: "gh",
        event,
        action: "push",
        repository: push.repository.full_name,
        branch: push.branch,
      },
    });
  }
}
