import type { Input, Output } from "./contract.js";
import type { PrPayload } from "./github.js";
import {
  buildFilesChanged,
  enrichOutput,
  formatMergeStatus,
} from "./enrich.js";

const SECRET_PATTERNS = /sk_live|api[_-]?key|password|secret|eval\s*\(/i;
const TEST_FILE = /\.(test|spec)\.(ts|js|tsx|jsx)$/i;

function emptyMerge(): PrPayload["merge"] {
  return {
    mergeable: null,
    mergeableState: "unknown",
    baseBranch: "unknown",
    headBranch: "unknown",
    hasConflicts: false,
  };
}

export async function fallback(
  input: Input,
  reason?: string,
  pr?: PrPayload,
): Promise<Output> {
  const demoFiles = input.demoDiff?.files ?? [];
  const issues: string[] = [];
  const security: string[] = [];
  const missingTests: string[] = [];

  if (reason) {
    issues.push(`Automated scan unavailable: ${reason}`);
  }

  for (const f of demoFiles) {
    const patch = f.patch ?? "";
    if (SECRET_PATTERNS.test(patch)) {
      security.push(`Possible secret or dangerous pattern in ${f.filename}`);
    }
    if (f.status === "removed" && TEST_FILE.test(f.filename)) {
      missingTests.push(`Test file removed: ${f.filename}`);
    }
    if (f.status === "added" && !TEST_FILE.test(f.filename) && patch.length > 80) {
      missingTests.push(`New code without matching test file: ${f.filename}`);
    }
  }

  const riskLevel: Output["riskLevel"] =
    security.length > 0
      ? "critical"
      : missingTests.length > 1
        ? "high"
        : issues.length > 0
          ? "medium"
          : "low";

  const partial: Output = {
    summary:
      `Heuristic PR scan for ${input.prUrl}. ` +
      `${pr?.totalFileCount ?? demoFiles.length} file(s). ` +
      `LLM unavailable — review manually.`,
    riskLevel,
    mergeStatus: pr ? formatMergeStatus(pr.merge) : "unknown",
    filesChanged: pr
      ? buildFilesChanged(pr)
      : buildFilesChanged({
          prUrl: input.prUrl,
          owner: "",
          repo: "",
          number: 0,
          title: "",
          body: null,
          state: "open",
          htmlUrl: input.prUrl,
          merge: emptyMerge(),
          allFiles: demoFiles.map((f) => ({
            filename: f.filename,
            status: f.status,
            additions: f.additions ?? 0,
            deletions: f.deletions ?? 0,
          })),
          files: [],
          totalAdditions: 0,
          totalDeletions: 0,
          totalFileCount: demoFiles.length,
        }),
    conflictNotes: [],
    conflictResolution: "",
    issuesFound: issues.length ? issues : ["No automated issues — manual review required"],
    securityNotes: security.length ? security : ["None identified (heuristic only)"],
    missingTests: missingTests.length ? missingTests : ["None identified (heuristic only)"],
    effectIfMerged:
      (pr?.totalFileCount ?? demoFiles.length) > 0
        ? "Changes would alter behavior in listed files; verify in staging before merge."
        : "Unable to assess diff — fetch PR data first.",
    recommendedNextAction:
      reason?.includes("auth")
        ? "Add GitHub token in UI or GITHUB_TOKEN in .env, then rescan."
        : "Re-run with LLM available or inspect the PR diff on GitHub directly.",
  };

  return pr
    ? enrichOutput(partial, pr)
    : {
        ...partial,
        conflictNotes: ["Unable to check merge status"],
        conflictResolution: "Fetch PR with a valid GitHub token to assess merge conflicts.",
      };
}
