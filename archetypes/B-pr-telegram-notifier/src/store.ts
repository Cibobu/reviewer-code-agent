import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export type SetupStep =
  | "welcome"
  | "repo"
  | "token"
  | "base_branch"
  | "webhook"
  | "ready";

export interface ChatConfig {
  chatId: string;
  setupStep: SetupStep;
  owner?: string;
  repo?: string;
  githubToken?: string;
  webhookSecret?: string;
  defaultBaseBranch: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR =
  process.env.AGENT_B_DATA_DIR?.trim() ||
  path.join(process.cwd(), "data", "agent-b");

function chatPath(chatId: string): string {
  return path.join(DATA_DIR, "chats", `${chatId}.json`);
}

export async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.join(DATA_DIR, "chats"), { recursive: true });
}

export async function loadChat(chatId: string): Promise<ChatConfig | null> {
  try {
    const raw = await fs.readFile(chatPath(chatId), "utf8");
    return JSON.parse(raw) as ChatConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function saveChat(config: ChatConfig): Promise<void> {
  await ensureDataDir();
  config.updatedAt = new Date().toISOString();
  await fs.writeFile(chatPath(config.chatId), JSON.stringify(config, null, 2));
}

export async function getOrCreateChat(chatId: string): Promise<ChatConfig> {
  const existing = await loadChat(chatId);
  if (existing) return existing;
  const now = new Date().toISOString();
  const config: ChatConfig = {
    chatId,
    setupStep: "welcome",
    defaultBaseBranch: "main",
    createdAt: now,
    updatedAt: now,
  };
  await saveChat(config);
  return config;
}

export function generateWebhookSecret(): string {
  return randomBytes(24).toString("hex");
}

export function isSetupComplete(config: ChatConfig): boolean {
  return (
    config.setupStep === "ready" &&
    Boolean(config.owner && config.repo && config.githubToken && config.webhookSecret)
  );
}

export function repoFullName(config: ChatConfig): string | null {
  if (!config.owner || !config.repo) return null;
  return `${config.owner}/${config.repo}`;
}

export async function findChatByRepo(
  owner: string,
  repo: string,
): Promise<ChatConfig | null> {
  await ensureDataDir();
  const dir = path.join(DATA_DIR, "chats");
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const cfg = await loadChat(file.replace(/\.json$/, ""));
    if (cfg?.owner === owner && cfg.repo === repo && isSetupComplete(cfg)) return cfg;
  }
  return null;
}

export async function loadChatByIdOrRepo(
  chatId: string,
  owner?: string,
  repo?: string,
): Promise<ChatConfig | null> {
  const byId = await loadChat(chatId);
  if (byId) return byId;
  if (owner && repo) return findChatByRepo(owner, repo);
  return null;
}
