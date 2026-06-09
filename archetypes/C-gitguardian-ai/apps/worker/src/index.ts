import { loadRootEnv } from "@gitguardian/shared/load-env";
loadRootEnv();

import { Worker, Queue } from "bullmq";
import { prisma, WebhookEventStatus, Severity, NotificationChannel } from "@gitguardian/db";
import { decrypt, hashContent } from "@gitguardian/shared";
import { chatIdForApi } from "@gitguardian/shared/telegram";
import { formatReviewTelegramMessage } from "@gitguardian/shared/telegram-review";
import { runAnalysisPipeline } from "@gitguardian/ai-pipeline";

const WEBHOOK_QUEUE = "webhook-events";
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

type DiffFile = {
  filename: string;
  status: string;
  patch?: string;
  additions?: number;
  deletions?: number;
};

async function fetchDiffFiles(
  token: string,
  owner: string,
  repo: string,
  opts: { prNumber?: number; base?: string; head?: string },
): Promise<DiffFile[]> {
  const fallback = process.env.GITHUB_TOKEN;

  async function request(url: string, authToken: string): Promise<DiffFile[]> {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${authToken}`, Accept: "application/vnd.github+json" },
    });
    if (res.status === 401 && fallback && authToken !== fallback) {
      return request(url, fallback);
    }
    if (!res.ok) {
      process.stderr.write(`[worker] GitHub API ${res.status} for ${url}\n`);
      return [];
    }
    const data = (await res.json()) as DiffFile[] | { files?: DiffFile[] };
    if (Array.isArray(data)) return data;
    return data.files ?? [];
  }

  if (opts.prNumber) {
    return request(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${opts.prNumber}/files?per_page=100`,
      token,
    );
  }
  if (opts.base && opts.head) {
    return request(
      `https://api.github.com/repos/${owner}/${repo}/compare/${opts.base}...${opts.head}`,
      token,
    );
  }
  return [];
}

function shouldNotifyTelegram(
  pref: string,
  severity: string,
  eventType: string,
  action?: string | null,
): boolean {
  switch (pref) {
    case "ALL_ACTIVITIES":
      return ["pull_request", "push", "create", "delete", "issues"].includes(eventType);
    case "PR_REVIEWS":
      return eventType === "pull_request";
    case "MERGE_SUMMARIES":
      return eventType === "pull_request" && action === "closed";
    case "DEPLOYMENT_RISKS":
      return eventType === "push";
    case "CRITICAL_ONLY":
      return severity === "CRITICAL";
    case "SECURITY_ONLY":
      return ["CRITICAL", "HIGH"].includes(severity);
    default:
      return ["CRITICAL", "HIGH"].includes(severity);
  }
}

async function sendTelegram(
  userId: string,
  text: string,
  severity: string,
  eventType: string,
  action?: string | null,
): Promise<boolean> {
  const tg = await prisma.telegramIntegration.findFirst({
    where: { userId, isActive: true },
  });
  if (!tg?.chatId) return false;

  if (!shouldNotifyTelegram(tg.notificationPreference, severity, eventType, action)) {
    return false;
  }

  const token = decrypt(tg.botTokenEncrypted);
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatIdForApi(tg.chatId),
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const body = (await res.json()) as { ok: boolean; description?: string };
  await prisma.telegramIntegration.update({
    where: { userId },
    data: {
      lastDeliveryStatus: body.ok ? "ok" : body.description ?? "failed",
      lastDeliveryAt: new Date(),
    },
  });
  return body.ok;
}

async function processWebhookEvent(webhookEventId: string, repositoryId: string): Promise<void> {
  const event = await prisma.webhookEvent.findUniqueOrThrow({ where: { id: webhookEventId } });

  if (event.eventType === "ping") {
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { status: WebhookEventStatus.COMPLETED, processedAt: new Date() },
    });
    return;
  }

  const repo = await prisma.repository.findUniqueOrThrow({
    where: { id: repositoryId },
    include: { user: true },
  });

  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: WebhookEventStatus.PROCESSING },
  });

  const payload = event.payload as Record<string, unknown>;
  const token = decrypt(repo.user.accessToken);
  const [owner, name] = repo.fullName.split("/");

  let files: DiffFile[] = [];
  let title = `${event.eventType}${event.action ? `.${event.action}` : ""}`;
  let author = "unknown";
  let baseBranch = repo.defaultBranch;
  let headBranch: string | undefined;

  if (event.eventType === "pull_request") {
    const pr = payload.pull_request as Record<string, unknown>;
    const number = (pr.number as number) ?? 0;
    title = (pr.title as string) ?? title;
    author = ((pr.user as { login?: string })?.login) ?? author;
    baseBranch = ((pr.base as { ref?: string })?.ref) ?? baseBranch;
    headBranch = ((pr.head as { ref?: string })?.ref) ?? undefined;
    files = await fetchDiffFiles(token, owner!, name!, { prNumber: number });
  } else if (event.eventType === "push") {
    const ref = (payload.ref as string) ?? "";
    headBranch = ref.replace("refs/heads/", "");
    author = ((payload.pusher as { name?: string })?.name) ?? author;
    const after = (payload.after as string) ?? "";
    const before = (payload.before as string) ?? "";
    if (after && !/^0+$/.test(after)) {
      files = await fetchDiffFiles(token, owner!, name!, { base: before, head: after });
    }
  } else if (event.eventType === "create" || event.eventType === "delete") {
    const ref = (payload.ref as string) ?? "";
    headBranch = ref;
    author = ((payload.sender as { login?: string })?.login) ?? author;
    title = `${event.eventType} ${payload.ref_type ?? "ref"}: ${ref}`;
  }

  if (!files.length && event.eventType === "issues") {
    const issue = payload.issue as Record<string, unknown> | undefined;
    title = (issue?.title as string) ?? title;
    author = ((issue?.user as { login?: string })?.login) ?? author;
  }

  // Layer 3 — cache skip unchanged files
  const uncachedFiles: DiffFile[] = [];
  for (const f of files) {
    const hash = hashContent(f.patch ?? f.filename);
    const hit = await prisma.analysisCache.findUnique({
      where: { repositoryId_filePath_contentHash: { repositoryId, filePath: f.filename, contentHash: hash } },
    });
    if (!hit) uncachedFiles.push(f);
  }

  const { review, ruleFindings, tokensUsed } = await runAnalysisPipeline({
    repository: repo.fullName,
    eventType: event.eventType,
    action: event.action ?? undefined,
    title,
    author,
    files: uncachedFiles.length ? uncachedFiles : files.slice(0, 5),
    baseBranch,
    headBranch,
  });

  const aiReview = await prisma.aIReview.create({
    data: {
      repositoryId,
      webhookEventId,
      changeSummary: review.changeSummary,
      securityScore: review.securityScore,
      securitySeverity: review.securitySeverity as Severity,
      impactAnalysis: review.impactAnalysis,
      codeQuality: review.codeQuality,
      contributors: review.contributors,
      recommendations: review.recommendations,
      tokensUsed,
    },
  });

  for (const f of ruleFindings) {
    await prisma.securityFinding.create({
      data: {
        repositoryId,
        aiReviewId: aiReview.id,
        category: f.category,
        severity: f.severity as Severity,
        title: f.title,
        description: f.title,
        filePath: f.filePath,
        lineHint: f.lineHint,
      },
    });
  }

  await prisma.repository.update({
    where: { id: repositoryId },
    data: {
      lastScanAt: new Date(),
      totalPrReviewed: { increment: event.eventType === "pull_request" ? 1 : 0 },
      securityScore: review.securityScore,
    },
  });

  const reviewUrl = `${process.env.WEB_URL ?? "http://localhost:3000"}/dashboard/repositories/${repositoryId}/reviews/${aiReview.id}`;
  await prisma.notification.create({
    data: {
      userId: repo.userId,
      aiReviewId: aiReview.id,
      channel: NotificationChannel.IN_APP,
      title: `${review.securitySeverity} — ${repo.fullName}`,
      body: review.changeSummary,
      delivered: true,
    },
  });

  const telegramText = formatReviewTelegramMessage({
    repo: repo.fullName,
    eventType: event.eventType,
    title,
    author,
    baseBranch,
    headBranch,
    severity: review.securitySeverity,
    score: review.securityScore,
    summary: review.changeSummary,
    files,
    findings: ruleFindings.map((f) => ({
      severity: f.severity,
      title: f.title,
      filePath: f.filePath,
      lineHint: f.lineHint,
      category: f.category,
    })),
    mustFix: review.recommendations.mustFix,
    recommended: review.recommendations.recommended,
    reviewUrl,
  });

  const telegramSent = await sendTelegram(
    repo.userId,
    telegramText,
    review.securitySeverity,
    event.eventType,
    event.action,
  );

  if (telegramSent) {
    await prisma.notification.create({
      data: {
        userId: repo.userId,
        aiReviewId: aiReview.id,
        channel: NotificationChannel.TELEGRAM,
        title: `${repo.fullName} — ${title}`,
        body: review.changeSummary,
        delivered: true,
      },
    });
  }

  await prisma.webhookEvent.update({
    where: { id: webhookEventId },
    data: { status: WebhookEventStatus.COMPLETED, processedAt: new Date() },
  });
}

/** Re-queue events left in PROCESSING after worker crash (e.g. dev restart). */
async function recoverStuckEvents(): Promise<void> {
  const cutoff = new Date(Date.now() - 2 * 60 * 1000);
  const stuck = await prisma.webhookEvent.findMany({
    where: {
      status: WebhookEventStatus.PROCESSING,
      createdAt: { lt: cutoff },
    },
    take: 20,
  });
  if (!stuck.length) return;

  const queue = new Queue(WEBHOOK_QUEUE, {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
  });

  for (const event of stuck) {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: WebhookEventStatus.PENDING, errorMessage: null },
    });
    await queue.add(
      "process",
      { webhookEventId: event.id, repositoryId: event.repositoryId },
      { attempts: 5, backoff: { type: "exponential", delay: 2000 } },
    );
    process.stderr.write(`[worker] recovered stuck ${event.eventType} event ${event.id}\n`);
  }
  await queue.close();
}

const worker = new Worker(
  WEBHOOK_QUEUE,
  async (job) => {
    const { webhookEventId, repositoryId } = job.data as {
      webhookEventId: string;
      repositoryId: string;
    };
    await processWebhookEvent(webhookEventId, repositoryId);
  },
  {
    connection: { url: redisUrl, maxRetriesPerRequest: null },
    concurrency: 3,
    lockDuration: 120_000,
    stalledInterval: 30_000,
    maxStalledCount: 2,
  },
);

void recoverStuckEvents();

worker.on("failed", async (job, err) => {
  if (!job?.data?.webhookEventId) return;
  const retries = job.opts.attempts ?? 1;
  if (job.attemptsMade >= retries) {
    await prisma.webhookEvent.update({
      where: { id: job.data.webhookEventId },
      data: {
        status: WebhookEventStatus.DEAD_LETTER,
        errorMessage: err.message,
      },
    });
  } else {
    await prisma.webhookEvent.update({
      where: { id: job.data.webhookEventId },
      data: {
        status: WebhookEventStatus.FAILED,
        retryCount: job.attemptsMade,
        errorMessage: err.message,
      },
    });
  }
});

process.stdout.write("[GitGuardian Worker] listening on webhook-events queue\n");
