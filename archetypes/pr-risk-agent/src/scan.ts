import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

export type SecretHit = {
  file: string;
  line: number;
  kind: string;
  preview: string;
};

const SECRET_PATTERNS: { kind: string; pattern: RegExp }[] = [
  { kind: "api_key_assignment", pattern: /\b(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=\s*\S+/i },
  { kind: "openai_style_key", pattern: /\bsk-[a-zA-Z0-9]{8,}\b/ },
  { kind: "aws_access_key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: "bearer_token", pattern: /\bBearer\s+[a-zA-Z0-9._-]{8,}\b/i },
  { kind: "generic_credential", pattern: /["'](?:password|secret|api[_-]?key)["']\s*:\s*["'][^"']+["']/i },
];

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage"]);

export function shouldScanFile(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  if (filePath === ".env" || filePath.endsWith("/.env")) return true;
  const ext = path.extname(filePath).toLowerCase();
  const textLike = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml",
    ".env", ".sh", ".py", ".go", ".rs", ".java", ".xml", ".html", ".css",
  ]);
  return textLike.has(ext) || !ext;
}

export function redactLine(line: string): string {
  return line
    .replace(/\bsk-[a-zA-Z0-9_-]+\b/g, "sk-[REDACTED]")
    .replace(/(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)(\s*=\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [REDACTED]");
}

export function scanText(content: string, file = "<inline>"): SecretHit[] {
  const hits: SecretHit[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { kind, pattern } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        hits.push({
          file,
          line: i + 1,
          kind,
          preview: redactLine(line.trim()).slice(0, 200),
        });
        break;
      }
    }
  }

  return hits;
}

export function scanFiles(files: string[], repoRoot = process.cwd()): SecretHit[] {
  const hits: SecretHit[] = [];

  for (const file of files) {
    if (!shouldScanFile(file)) continue;
    const full = path.join(repoRoot, file);
    if (!existsSync(full)) continue;
    try {
      const content = readFileSync(full, "utf8");
      hits.push(...scanText(content, file));
    } catch {
      // binary or unreadable — skip
    }
  }

  return hits;
}

export function formatSecretReport(hits: SecretHit[]): string {
  if (!hits.length) return "### secret scan\nNo credential-like patterns detected in changed files.";
  const lines = hits.map(
    (h) => `- ${h.file}:${h.line} [${h.kind}] ${h.preview}`,
  );
  return `### secret scan\n${hits.length} potential secret(s) found:\n${lines.join("\n")}`;
}
