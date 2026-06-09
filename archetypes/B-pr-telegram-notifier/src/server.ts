import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ARCHETYPES } from "@foru-workshop/contracts";

import { InputSchema } from "./contract.js";
import { handle } from "./handler.js";
import { verifyGithubWebhookSignature } from "./github-webhook.js";
import { loadChat } from "./store.js";
import {
  handleTelegramUpdate,
  processGithubEventForChat,
  type TelegramUpdate,
} from "./telegram-bot.js";
import { ensureDataDir } from "./store.js";
import { registerTelegramWebhook } from "./telegram.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(HERE, "../public");
const SOUL_PATH = path.resolve(HERE, "../SOUL.md");
const PORT = Number(process.env.PORT ?? 9005);
const MAX_BODY_BYTES = 512 * 1024;
const META = ARCHETYPES.B;

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function serveStatic(
  res: ServerResponse,
  filePath: string,
  contentType: string,
): Promise<void> {
  try {
    const body = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}

async function handleInvoke(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const raw = await readBody(req);
    const input = raw ? JSON.parse(raw) : {};
    const parsed = InputSchema.safeParse(input);
    if (!parsed.success) {
      sendJson(res, 400, { error: "Invalid input", detail: parsed.error.flatten() });
      return;
    }
    const output = await handle(parsed.data);
    sendJson(res, 200, output);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}

async function handleGithubWebhookForChat(
  req: IncomingMessage,
  res: ServerResponse,
  chatId: string,
  rawBody: string,
): Promise<void> {
  const config = await loadChat(chatId);
  const secret = config?.webhookSecret?.trim();
  if (!secret) {
    sendJson(res, 404, { error: "Chat not configured" });
    return;
  }

  const signature = req.headers["x-hub-signature-256"];
  const sig = Array.isArray(signature) ? signature[0] : signature;
  if (!verifyGithubWebhookSignature(rawBody, sig, secret)) {
    sendJson(res, 401, { error: "Invalid webhook signature" });
    return;
  }

  const event = req.headers["x-github-event"];
  const eventName = (Array.isArray(event) ? event[0] : event) ?? "unknown";

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    sendJson(res, 400, { error: "Invalid JSON" });
    return;
  }

  sendJson(res, 202, { accepted: true, chatId, event: eventName });

  setImmediate(() => {
    processGithubEventForChat(chatId, eventName, payload).catch((err) => {
      process.stderr.write(
        `[github/${chatId}] ${err instanceof Error ? err.message : String(err)}\n`,
      );
    });
  });
}

async function handleTelegramWebhook(
  res: ServerResponse,
  rawBody: string,
): Promise<void> {
  let update: TelegramUpdate;
  try {
    update = JSON.parse(rawBody) as TelegramUpdate;
  } catch {
    sendJson(res, 400, { error: "Invalid JSON" });
    return;
  }

  sendJson(res, 200, { ok: true });

  setImmediate(() => {
    handleTelegramUpdate(update).catch((err) => {
      process.stderr.write(
        `[telegram] ${err instanceof Error ? err.message : String(err)}\n`,
      );
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      archetype: "B",
      role: META.role,
      mode: "telegram-bot",
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      publicUrl: Boolean(process.env.PUBLIC_BASE_URL),
    });
    return;
  }
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    await serveStatic(res, path.join(PUBLIC_DIR, "index.html"), "text/html; charset=utf-8");
    return;
  }
  if (req.method === "GET" && url.pathname === "/soul") {
    await serveStatic(res, SOUL_PATH, "text/markdown; charset=utf-8");
    return;
  }
  if (req.method === "POST" && url.pathname === "/invoke") {
    await handleInvoke(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/webhook/telegram") {
    try {
      const raw = await readBody(req);
      await handleTelegramWebhook(res, raw);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  const ghMatch = url.pathname.match(/^\/webhook\/github\/(\d+)$/);
  if (req.method === "POST" && ghMatch?.[1]) {
    const chatId = ghMatch[1];
    try {
      const raw = await readBody(req);
      await handleGithubWebhookForChat(req, res, chatId, raw);
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

async function boot(): Promise<void> {
  await ensureDataDir();

  server.listen(PORT, () => {
    process.stdout.write(
      `[archetype B · ${META.role}] listening on http://0.0.0.0:${PORT}\n`,
    );
    process.stdout.write(`  Telegram:  POST /webhook/telegram\n`);
    process.stdout.write(`  GitHub:    POST /webhook/github/:chatId\n`);
  });

  const base = process.env.PUBLIC_BASE_URL?.trim();
  if (base && process.env.TELEGRAM_BOT_TOKEN) {
    try {
      await registerTelegramWebhook(base);
    } catch (err) {
      process.stderr.write(
        `[telegram] webhook register failed: ${err instanceof Error ? err.message : err}\n`,
      );
    }
  }
}

boot().catch((err) => {
  console.error(err);
  process.exit(1);
});
