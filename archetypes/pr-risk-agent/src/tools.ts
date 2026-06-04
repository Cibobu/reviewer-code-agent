import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { collectGitContext, formatGitReport } from "./git.js";
import { formatSecretReport, redactLine, scanFiles } from "./scan.js";

export type ToolReport = {
  git: string;
  secrets: string;
  tests: string;
  packageInfo: string;
};

function readPackageJson(): Record<string, unknown> | null {
  const pkgPath = path.join(process.cwd(), "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function runNpmTest(): string {
  const pkg = readPackageJson();
  const scripts = (pkg?.scripts ?? {}) as Record<string, string>;
  if (!scripts.test) {
    return "### test run\nSkipped: no `test` script in package.json.";
  }

  try {
    const out = execFileSync("npm", ["test"], {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
      timeout: 120_000,
    });
    return `### test run\nExit: 0\n${redactLine(out).slice(0, 8000)}`;
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    const status = e.status ?? "unknown";
    const combined = [e.stdout, e.stderr].filter(Boolean).join("\n");
    return `### test run\nExit: ${status}\n${redactLine(combined).slice(0, 8000)}`;
  }
}

function formatPackageInfo(): string {
  const pkg = readPackageJson();
  if (!pkg) return "### package.json\n(not found)";

  const scripts = (pkg.scripts ?? {}) as Record<string, string>;
  const scriptLines = Object.keys(scripts).length
    ? Object.entries(scripts).map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "(no scripts)";

  const deps = Object.keys((pkg.dependencies ?? {}) as Record<string, unknown>);
  const devDeps = Object.keys((pkg.devDependencies ?? {}) as Record<string, unknown>);

  return [
    "### package.json",
    `name: ${String(pkg.name ?? "(unnamed)")}`,
    "scripts:",
    scriptLines,
    `dependencies: ${deps.join(", ") || "(none)"}`,
    `devDependencies: ${devDeps.join(", ") || "(none)"}`,
  ].join("\n");
}

export function runLocalTools(): ToolReport {
  const gitCtx = collectGitContext();
  const secretHits = scanFiles(gitCtx.changedFiles);
  const runTests = process.env.PR_AGENT_RUN_TESTS === "1";

  return {
    git: formatGitReport(gitCtx),
    secrets: formatSecretReport(secretHits),
    tests: runTests ? runNpmTest() : "### test run\nSkipped (set PR_AGENT_RUN_TESTS=1 to run npm test).",
    packageInfo: formatPackageInfo(),
  };
}

export function buildToolResultsBlock(report: ToolReport): string {
  return [report.git, report.secrets, report.tests, report.packageInfo].join("\n\n");
}
