import type { PrFile, PrMergeInfo, PrPayload } from "./github.js";
import type { FileChanged, PrScannerOutput } from "@foru-workshop/contracts/src/research.js";

export function formatMergeStatus(merge: PrMergeInfo): string {
  const conflict = merge.hasConflicts ? " — CONFLICTS" : "";
  const mergeable =
    merge.mergeable === null ? "unknown" : merge.mergeable ? "yes" : "no";
  return (
    `${merge.mergeableState}${conflict} · mergeable=${mergeable} · ` +
    `base:${merge.baseBranch} ← head:${merge.headBranch}`
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "added":
      return "New file";
    case "removed":
      return "Deleted";
    case "renamed":
      return "Renamed";
    case "modified":
      return "Modified";
    default:
      return status;
  }
}

export function fileChangeSummary(f: PrFile): string {
  return `${statusLabel(f.status)} (+${f.additions}/-${f.deletions})`;
}

export function buildFilesChanged(
  pr: PrPayload,
  llmFiles: FileChanged[] = [],
): FileChanged[] {
  const byName = new Map(llmFiles.map((f) => [f.filename, f]));
  return pr.allFiles.map((f) => {
    const fromLlm = byName.get(f.filename);
    return {
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      summary: fromLlm?.summary?.trim() || fileChangeSummary(f),
    };
  });
}

export function buildConflictNotes(pr: PrPayload, llmNotes: string[] = []): string[] {
  const notes = [...llmNotes];
  if (pr.merge.hasConflicts) {
    notes.unshift(
      `GitHub mergeable_state=${pr.merge.mergeableState} — branch cannot merge cleanly into ${pr.merge.baseBranch}.`,
    );
    const heavy = pr.allFiles
      .filter((f) => f.status === "modified" && f.additions + f.deletions > 100)
      .slice(0, 5)
      .map((f) => `Large change may conflict: ${f.filename} (+${f.additions}/-${f.deletions})`);
    notes.push(...heavy);
  } else if (notes.length === 0) {
    notes.push("No merge conflicts reported by GitHub.");
  }
  return [...new Set(notes.filter(Boolean))];
}

export function buildConflictResolution(pr: PrPayload, llmResolution: string): string {
  if (!pr.merge.hasConflicts) {
    return llmResolution.trim() || "No merge conflicts — proceed with review and merge when approved.";
  }

  const steps = [
    `1. Fetch latest: git fetch origin`,
    `2. Checkout PR branch: git checkout ${pr.merge.headBranch}`,
    `3. Merge base into head: git merge origin/${pr.merge.baseBranch}`,
    `4. Resolve conflict markers in affected files (GitHub UI or local editor).`,
    `5. Run tests and lint, then commit: git commit`,
    `6. Push: git push origin ${pr.merge.headBranch}`,
  ].join("\n");

  const hint = llmResolution.trim();
  if (!hint || hint.startsWith("1. Fetch latest")) return hint || steps;
  if (hint.includes("git fetch origin")) return hint;
  return `${steps}\n\nReview focus: ${hint}`;
}

/** Merge authoritative GitHub facts with LLM analysis. */
export function enrichOutput(partial: PrScannerOutput, pr: PrPayload): PrScannerOutput {
  return {
    ...partial,
    mergeStatus: formatMergeStatus(pr.merge),
    filesChanged: buildFilesChanged(pr, partial.filesChanged),
    conflictNotes: buildConflictNotes(pr, partial.conflictNotes),
    conflictResolution: buildConflictResolution(pr, partial.conflictResolution),
  };
}
