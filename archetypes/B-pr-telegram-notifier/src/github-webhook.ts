import { createHmac, timingSafeEqual } from "node:crypto";

export const PR_WEBHOOK_ACTIONS = new Set([
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
]);

export interface PullRequestWebhookPayload {
  action: string;
  number: number;
  pull_request: {
    number: number;
    html_url: string;
    title: string;
    state: string;
    draft?: boolean;
  };
  repository: {
    full_name: string;
    html_url: string;
  };
  sender: { login: string };
}

export interface PushWebhookPayload {
  ref: string;
  repository: { full_name: string; html_url: string };
}

export function verifyGithubWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex"),
    );
  } catch {
    return false;
  }
}

export function parsePullRequestEvent(
  event: string,
  payload: unknown,
): PullRequestWebhookPayload | null {
  if (event !== "pull_request") return null;
  if (!payload || typeof payload !== "object") return null;
  const p = payload as PullRequestWebhookPayload;
  if (!p.pull_request?.html_url || !p.repository?.full_name) return null;
  return p;
}

export function parsePushEvent(
  event: string,
  payload: unknown,
): { branch: string; repository: { full_name: string } } | null {
  if (event !== "push") return null;
  if (!payload || typeof payload !== "object") return null;
  const p = payload as PushWebhookPayload;
  if (!p.ref?.startsWith("refs/heads/") || !p.repository?.full_name) return null;
  return {
    branch: p.ref.replace("refs/heads/", ""),
    repository: p.repository,
  };
}

export function shouldProcessPrAction(action: string): boolean {
  return PR_WEBHOOK_ACTIONS.has(action);
}

export function prUrlFromPayload(payload: PullRequestWebhookPayload): string {
  return payload.pull_request.html_url;
}
