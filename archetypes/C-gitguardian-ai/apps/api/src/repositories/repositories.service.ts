import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma, AgentStatus, NotificationChannel } from "@gitguardian/db";
import { decrypt, encrypt } from "@gitguardian/shared";
import { webhookUrlForRepository } from "@gitguardian/shared/urls";
import { randomBytes, createHmac } from "node:crypto";

const GITHUB_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

type GitHubHook = { id: number; config?: { url?: string } };
type GitHubHookError = {
  message?: string;
  errors?: Array<{ message?: string; field?: string }>;
};

function isLocalWebhookUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
  } catch {
    return true;
  }
}

function normalizeUrl(url: string): string {
  return url.replace(/([^:]\/)\/+/g, "$1");
}

function formatGitHubError(body: GitHubHookError, status: number): string {
  const details = body.errors?.map((e) => e.message ?? e.field).filter(Boolean) ?? [];
  const base = body.message ?? `GitHub API error (${status})`;
  return details.length ? `${base}: ${details.join(", ")}` : base;
}

@Injectable()
export class RepositoriesService {
  async listForUser(userId: string) {
    const repos = await prisma.repository.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });

    const unread = await prisma.notification.findMany({
      where: { userId, read: false, channel: NotificationChannel.IN_APP },
      select: { aiReview: { select: { repositoryId: true } } },
    });
    const unreadByRepo: Record<string, number> = {};
    for (const n of unread) {
      const repoId = n.aiReview?.repositoryId;
      if (repoId) unreadByRepo[repoId] = (unreadByRepo[repoId] ?? 0) + 1;
    }

    return repos.map((r) => ({
      ...r,
      unreadReviewCount: unreadByRepo[r.id] ?? 0,
    }));
  }

  async syncFromGitHub(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const token = decrypt(user.accessToken);
    const res = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
    });
    const repos = (await res.json()) as Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      language: string | null;
      private: boolean;
      stargazers_count: number;
      forks_count: number;
      default_branch: string;
      updated_at: string;
    }>;

    for (const r of repos) {
      await prisma.repository.upsert({
        where: { userId_githubRepoId: { userId, githubRepoId: r.id } },
        create: {
          userId,
          githubRepoId: r.id,
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          language: r.language,
          visibility: r.private ? "private" : "public",
          stars: r.stargazers_count,
          forks: r.forks_count,
          defaultBranch: r.default_branch,
          githubUpdatedAt: new Date(r.updated_at),
        },
        update: {
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          forks: r.forks_count,
          githubUpdatedAt: new Date(r.updated_at),
        },
      });
    }
    return this.listForUser(userId);
  }

  async connectAgent(userId: string, repositoryId: string) {
    const repo = await prisma.repository.findFirst({
      where: { id: repositoryId, userId },
    });
    if (!repo) throw new NotFoundException("Repository not found");

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const token = decrypt(user.accessToken);
    const secret = randomBytes(24).toString("hex");
    const [owner, name] = repo.fullName.split("/");
    const webhookUrl = webhookUrlForRepository(repo.id);
    const localDev = isLocalWebhookUrl(webhookUrl);

    let hookId: number | null = repo.webhookId;
    let warning: string | undefined;

    // Update existing GitHub hook URL if reconnecting (fixes //api double-slash etc.)
    if (hookId) {
      await fetch(`https://api.github.com/repos/${owner}/${name}/hooks/${hookId}`, {
        method: "PATCH",
        headers: { ...GITHUB_HEADERS(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          active: true,
          events: ["pull_request", "push", "create", "delete", "issues"],
          config: { url: webhookUrl, content_type: "json", secret, insecure_ssl: "0" },
        }),
      });
    }

    // Reuse hook with same normalized URL
    const listRes = await fetch(`https://api.github.com/repos/${owner}/${name}/hooks`, {
      headers: GITHUB_HEADERS(token),
    });
    if (listRes.ok && !hookId) {
      const existing = (await listRes.json()) as GitHubHook[];
      const match = existing.find(
        (h) => h.config?.url && normalizeUrl(h.config.url) === normalizeUrl(webhookUrl),
      );
      if (match) hookId = match.id;
    }

    if (!hookId) {
      const ghRes = await fetch(`https://api.github.com/repos/${owner}/${name}/hooks`, {
        method: "POST",
        headers: { ...GITHUB_HEADERS(token), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "web",
          active: true,
          events: ["pull_request", "push", "create", "delete", "issues"],
          config: { url: webhookUrl, content_type: "json", secret, insecure_ssl: "0" },
        }),
      });
      const hookBody = (await ghRes.json()) as GitHubHook & GitHubHookError;

      if (hookBody.id) {
        hookId = hookBody.id;
      } else if (localDev && hookBody.message?.includes("Validation Failed")) {
        // GitHub cannot reach localhost — enable agent locally without remote webhook
        warning =
          "Local dev mode: GitHub webhook not registered (localhost is not reachable). " +
          "Set PUBLIC_API_URL to a public HTTPS URL (e.g. ngrok) for live events.";
      } else {
        const msg = formatGitHubError(hookBody, ghRes.status);
        if (msg.includes("admin:repo_hook") || ghRes.status === 403) {
          throw new BadRequestException(
            "Missing permission to create webhooks. Re-login with repo hook access or use a token with admin:repo_hook.",
          );
        }
        throw new BadRequestException(
          localDev
            ? `${msg}. For local development, expose your API via ngrok and set PUBLIC_API_URL in .env.`
            : msg,
        );
      }
    }

    await prisma.repository.update({
      where: { id: repo.id },
      data: {
        agentStatus: AgentStatus.ACTIVE,
        webhookId: hookId,
        webhookSecret: encrypt(secret),
      },
    });

    await prisma.repositoryConfiguration.upsert({
      where: { repositoryId: repo.id },
      create: { repositoryId: repo.id },
      update: {},
    });

    const updated = await prisma.repository.findUniqueOrThrow({ where: { id: repo.id } });
    return { ...updated, warning, webhookUrl };
  }

  async disconnectAgent(userId: string, repositoryId: string) {
    const repo = await prisma.repository.findFirst({
      where: { id: repositoryId, userId },
    });
    if (!repo) throw new NotFoundException();

    if (repo.webhookId) {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const token = decrypt(user.accessToken);
      const [owner, name] = repo.fullName.split("/");
      await fetch(`https://api.github.com/repos/${owner}/${name}/hooks/${repo.webhookId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
      });
    }

    return prisma.repository.update({
      where: { id: repo.id },
      data: { agentStatus: AgentStatus.INACTIVE, webhookId: null, webhookSecret: null },
    });
  }

  verifySignature(rawBody: string, signature: string | undefined, secret: string): boolean {
    if (!signature?.startsWith("sha256=")) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const received = signature.slice(7);
    return expected === received;
  }
}
