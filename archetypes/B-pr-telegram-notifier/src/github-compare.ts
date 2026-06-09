import { GitHubPrError } from "../../A-head-of-research/src/github.js";
import type { PrFile } from "../../A-head-of-research/src/github.js";

export interface BranchComparePayload {
  owner: string;
  repo: string;
  base: string;
  head: string;
  compareUrl: string;
  status: string;
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  allFiles: PrFile[];
  files: PrFile[];
  totalAdditions: number;
  totalDeletions: number;
  totalFileCount: number;
}

const GITHUB_API =
  process.env.GITHUB_API_BASE_URL?.replace(/\/$/, "") ??
  "https://api.github.com";

const MAX_PATCH_FILES = 15;
const MAX_PATCH_CHARS = 4_000;

type RawCompareFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "foru-pr-telegram-bot",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function ghGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders(token) });
  if (res.status === 401) {
    throw new GitHubPrError(
      "Token GitHub tidak valid.",
      "auth",
      "Kirim ulang token via /setup di bot Telegram.",
    );
  }
  if (res.status === 404) {
    throw new GitHubPrError(
      "Branch atau repo tidak ditemukan.",
      "not_found",
      "Periksa nama branch dan akses repo.",
    );
  }
  if (res.status === 403) {
    throw new GitHubPrError("Akses GitHub ditolak.", "forbidden");
  }
  if (!res.ok) {
    throw new GitHubPrError(`GitHub API ${res.status}`, "api");
  }
  return (await res.json()) as T;
}

function truncatePatch(patch?: string): string | undefined {
  if (!patch) return undefined;
  if (patch.length <= MAX_PATCH_CHARS) return patch;
  return `${patch.slice(0, MAX_PATCH_CHARS)}\n… [truncated]`;
}

function splitFiles(rawFiles: RawCompareFile[]): {
  allFiles: PrFile[];
  filesWithPatch: PrFile[];
} {
  const allFiles: PrFile[] = rawFiles.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
  }));
  const ranked = [...rawFiles].sort(
    (a, b) => b.additions + b.deletions - (a.additions + a.deletions),
  );
  const names = new Set(ranked.slice(0, MAX_PATCH_FILES).map((f) => f.filename));
  const filesWithPatch = rawFiles
    .filter((f) => names.has(f.filename))
    .map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: truncatePatch(f.patch),
    }));
  return { allFiles, filesWithPatch };
}

export async function fetchBranchCompare(
  owner: string,
  repo: string,
  base: string,
  head: string,
  token?: string,
): Promise<BranchComparePayload> {
  const compare = await ghGet<{
    status: string;
    ahead_by: number;
    behind_by: number;
    total_commits: number;
    html_url: string;
    files?: RawCompareFile[];
  }>(`/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`, token);

  const rawFiles = compare.files ?? [];
  const { allFiles, filesWithPatch } = splitFiles(rawFiles);

  return {
    owner,
    repo,
    base,
    head,
    compareUrl: compare.html_url,
    status: compare.status,
    aheadBy: compare.ahead_by,
    behindBy: compare.behind_by,
    totalCommits: compare.total_commits,
    allFiles,
    files: filesWithPatch,
    totalAdditions: allFiles.reduce((a, f) => a + f.additions, 0),
    totalDeletions: allFiles.reduce((a, f) => a + f.deletions, 0),
    totalFileCount: allFiles.length,
  };
}

export function branchCompareFromDemo(
  owner: string,
  repo: string,
  base: string,
  head: string,
  demoFiles: Array<{
    filename: string;
    status: string;
    additions?: number;
    deletions?: number;
    patch?: string;
  }>,
): BranchComparePayload {
  const raw = demoFiles.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
    patch: f.patch,
  }));
  const { allFiles, filesWithPatch } = splitFiles(raw);
  return {
    owner,
    repo,
    base,
    head,
    compareUrl: `https://github.com/${owner}/${repo}/compare/${base}...${head}`,
    status: "ahead",
    aheadBy: 1,
    behindBy: 0,
    totalCommits: 1,
    allFiles,
    files: filesWithPatch,
    totalAdditions: allFiles.reduce((a, f) => a + f.additions, 0),
    totalDeletions: allFiles.reduce((a, f) => a + f.deletions, 0),
    totalFileCount: allFiles.length,
  };
}
