import { chatJson, loadSoul } from "@foru-workshop/llm";
import { ResearchOutputSchema, type ResearchOutput } from "@foru-workshop/contracts/src/research.js";
import { brain as scanPullRequest } from "../../A-head-of-research/src/brain.js";
import type { Input } from "./contract.js";
import {
  branchCompareFromDemo,
  fetchBranchCompare,
  type BranchComparePayload,
} from "./github-compare.js";

export async function reviewPullRequest(
  input: Input,
): Promise<ResearchOutput> {
  return (await scanPullRequest({
    prUrl: input.prUrl!,
    githubToken: input.githubToken,
    demoDiff: input.demoDiff,
  })) as ResearchOutput;
}

export async function reviewBranchCompare(
  input: Input,
): Promise<{ review: ResearchOutput; payload: BranchComparePayload }> {
  const bc = input.branchCompare!;
  const token = input.githubToken ?? process.env.GITHUB_TOKEN;

  let payload: BranchComparePayload;
  if (input.demoDiff) {
    payload = branchCompareFromDemo(
      bc.owner,
      bc.repo,
      bc.base,
      bc.head,
      input.demoDiff.files,
    );
  } else {
    payload = await fetchBranchCompare(
      bc.owner,
      bc.repo,
      bc.base,
      bc.head,
      token,
    );
  }

  const soul = await loadSoul(import.meta.url);

  const llmOut = await chatJson(
    [
      { role: "system", content: soul },
      {
        role: "user",
        content: JSON.stringify({
          scanType: "branch_compare",
          compare: {
            repository: `${payload.owner}/${payload.repo}`,
            base: payload.base,
            head: payload.head,
            compareUrl: payload.compareUrl,
            status: payload.status,
            aheadBy: payload.aheadBy,
            behindBy: payload.behindBy,
            totalCommits: payload.totalCommits,
            stats: {
              totalFiles: payload.totalFileCount,
              additions: payload.totalAdditions,
              deletions: payload.totalDeletions,
            },
            fileInventory: payload.allFiles,
            filesWithPatch: payload.files,
          },
        }),
      },
    ],
    ResearchOutputSchema,
    { temperature: 0.2, maxTokens: 2000 },
  );

  const mergeStatus =
    llmOut.mergeStatus ||
    `${payload.head} → ${payload.base} · ${payload.status} · ${payload.aheadBy} commit(s) ahead`;

  return {
    review: { ...llmOut, mergeStatus },
    payload,
  };
}

export async function runReview(
  input: Input,
): Promise<{
  scanType: "pr" | "branch_compare";
  review: ResearchOutput;
  branchPayload?: BranchComparePayload;
  link: string;
}> {
  if (input.scanType === "branch_compare") {
    const { review, payload } = await reviewBranchCompare(input);
    return {
      scanType: "branch_compare",
      review,
      branchPayload: payload,
      link: payload.compareUrl,
    };
  }

  const review = await reviewPullRequest(input);
  return {
    scanType: "pr",
    review,
    link: input.prUrl!,
  };
}
