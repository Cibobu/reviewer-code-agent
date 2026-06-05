// Standalone HTTP server for archetype A — PR Risk Scanner.
//
//   GET  /          → operating page (public/index.html)
//   GET  /soul      → SOUL.md as plain text
//   POST /invoke    → REST endpoint matching contract.ts
//   ANY  /mcp       → MCP Streamable HTTP transport
//   GET  /health    → liveness probe

import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { ARCHETYPES } from "@foru-workshop/contracts";

import { InputSchema } from "./contract.js";
import { handle } from "./handler.js";
import { buildMcpServer } from "./mcp.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(HERE, "../public");
const SOUL_PATH = path.resolve(HERE, "../SOUL.md");
const PORT = Number(process.env.PORT ?? 8080);
const MAX_BODY_BYTES = 256 * 1024;
const META = ARCHETYPES.A;

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

const mcpTransports = new Map<string, StreamableHTTPServerTransport>();

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    let parsedBody: unknown;
    if (req.method === "POST") {
      const raw = await readBody(req);
      parsedBody = raw ? JSON.parse(raw) : undefined;
    }

    const sessionId = req.headers["mcp-session-id"];
    const sessionKey = Array.isArray(sessionId) ? sessionId[0] : sessionId;
    let transport = sessionKey ? mcpTransports.get(sessionKey) : undefined;

    if (!transport) {
      if (req.method !== "POST" || !isInitializeRequest(parsedBody)) {
        sendJson(res, 400, {
          jsonrpc: "2.0",
          error: { code: -32000, message: "Missing or unknown Mcp-Session-Id" },
          id: null,
        });
        return;
      }
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          mcpTransports.set(id, transport!);
        },
      });
      transport.onclose = () => {
        if (transport!.sessionId) mcpTransports.delete(transport!.sessionId);
      };
      const server = buildMcpServer();
      await server.connect(transport);
    }

    await transport.handleRequest(req, res, parsedBody);
  } catch (err) {
    if (!res.headersSent) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    } else {
      res.end();
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true, archetype: "A", role: META.role });
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
  if (url.pathname === "/mcp") {
    await handleMcp(req, res);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  process.stdout.write(
    `[archetype A · ${META.role}] listening on http://0.0.0.0:${PORT}\n`,
  );
});
