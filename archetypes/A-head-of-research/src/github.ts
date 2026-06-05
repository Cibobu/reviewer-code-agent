import type { PrScannerInput } from "@foru-workshop/contracts/src/research.js";

export interface PrFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PrMergeInfo {
  mergeable: boolean | null;
  mergeableState: string;
  baseBranch: string;
  headBranch: string;
  hasConflicts: boolean;
}

export interface PrPayload {
  prUrl: string;
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string | null;
  state: string;
  htmlUrl: string;
  merge: PrMergeInfo;
  /** Every changed file (metadata). */
  allFiles: PrFile[];
  /** Subset with patch text for LLM deep review. */
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

type RawGhFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export function parsePrUrl(
  url: string,
): { owner: string; repo: string; number: number } {
  const u = new URL(url);
  const m = u.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
  if (!m || !m[1] || !m[2] || !m[3]) {
    throw new Error(
      "Invalid GitHub PR URL. Expected https://github.com/owner/repo/pull/123",
    );
  }
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

function ghHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "foru-pr-risk-scanner",
  };
  const t = token ?? process.env.GITHUB_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function ghGet<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: ghHeaders(token) });
  if (res.status === 401) {
    throw new Error("GitHub auth required — set githubToken or GITHUB_TOKEN in .env");
  }
  if (res.status === 404) {
    throw new Error("PR not found — check URL or repo visibility");
  }
  if (res.status === 403) {
    throw new Error("GitHub rate limit or forbidden — add a token");
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub API ${res.status}: ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

function truncatePatch(patch?: string): string | undefined {
  if (!patch) return undefined;
  if (patch.length <= MAX_PATCH_CHARS) return patch;
  return `${patch.slice(0, MAX_PATCH_CHARS)}\n… [truncated]`;
}

async function fetchAllPrFiles(
  owner: string,
  repo: string,
  number: number,
  token?: string,
): Promise<RawGhFile[]> {
  const all: RawGhFile[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await ghGet<RawGhFile[]>(
      `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`,
      token,
    );
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

function buildMergeInfo(pr: {
  mergeable: boolean | null;
  mergeable_state: string;
  base: { ref: string };
  head: { ref: string };
}): PrMergeInfo {
  const mergeableState = pr.mergeable_state ?? "unknown";
  const hasConflicts =
    mergeableState === "dirty" ||
    pr.mergeable === false;
  return {
    mergeable: pr.mergeable,
    mergeableState,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    hasConflicts,
  };
}

function splitFilesForLlm(rawFiles: RawGhFile[]): {
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
  const patchNames = new Set(
    ranked.slice(0, MAX_PATCH_FILES).map((f) => f.filename),
  );

  const filesWithPatch: PrFile[] = rawFiles
    .filter((f) => patchNames.has(f.filename))
    .map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: truncatePatch(f.patch),
    }));

  return { allFiles, filesWithPatch };
}

export async function fetchPullRequest(
  prUrl: string,
  token?: string,
): Promise<PrPayload> {
  const { owner, repo, number } = parsePrUrl(prUrl);

  const pr = await ghGet<{
    title: string;
    body: string | null;
    state: string;
    html_url: string;
    additions: number;
    deletions: number;
    mergeable: boolean | null;
    mergeable_state: string;
    base: { ref: string };
    head: { ref: string };
  }>(`/repos/${owner}/${repo}/pulls/${number}`, token);

  const rawFiles = await fetchAllPrFiles(owner, repo, number, token);
  const { allFiles, filesWithPatch } = splitFilesForLlm(rawFiles);

  return {
    prUrl,
    owner,
    repo,
    number,
    title: pr.title,
    body: pr.body,
    state: pr.state,
    htmlUrl: pr.html_url,
    merge: buildMergeInfo(pr),
    allFiles,
    files: filesWithPatch,
    totalAdditions: pr.additions,
    totalDeletions: pr.deletions,
    totalFileCount: allFiles.length,
  };
}

export function demoToPayload(
  prUrl: string,
  demo: NonNullable<PrScannerInput["demoDiff"]>,
): PrPayload {
  const { owner, repo, number } = parsePrUrl(prUrl);
  const rawFiles = demo.files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions ?? 0,
    deletions: f.deletions ?? 0,
    patch: f.patch,
  }));
  const { allFiles, filesWithPatch } = splitFilesForLlm(rawFiles);

  return {
    prUrl,
    owner,
    repo,
    number,
    title: demo.title,
    body: demo.body ?? null,
    state: "open",
    htmlUrl: prUrl,
    merge: demo.merge ?? {
      mergeable: false,
      mergeableState: "dirty",
      baseBranch: "main",
      headBranch: "feature/demo",
      hasConflicts: true,
    },
    allFiles,
    files: filesWithPatch,
    totalAdditions: allFiles.reduce((a, f) => a + f.additions, 0),
    totalDeletions: allFiles.reduce((a, f) => a + f.deletions, 0),
    totalFileCount: allFiles.length,
  };
}
