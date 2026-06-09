// ============================================================================
// ARCHETYPE A — PR RISK SCANNER
// ============================================================================

import { z } from "zod";
import { chatJson, loadSoul, RateLimitError } from "@foru-workshop/llm";
import { OutputSchema, type Input, type Output } from "./contract.js";
import { demoToPayload, fetchPullRequest, GitHubPrError } from "./github.js";
import { enrichOutput } from "./enrich.js";
import { fallback } from "./fallback.js";

export async function brain(input: Input): Promise<Output> {
  const soul = await loadSoul(import.meta.url);

  let pr;
  try {
    if (input.demoDiff) {
      pr = demoToPayload(input.prUrl, input.demoDiff);
    } else {
      pr = await fetchPullRequest(
        input.prUrl,
        input.githubToken ?? process.env.GITHUB_TOKEN,
      );
    }
  } catch (err) {
    if (err instanceof GitHubPrError) throw err;
    return fallback(input, err instanceof Error ? err.message : String(err));
  }

  const messages = [
    { role: "system" as const, content: soul },
    {
      role: "user" as const,
      content: JSON.stringify({
        input: { prUrl: input.prUrl },
        pr: {
          title: pr.title,
          body: pr.body,
          state: pr.state,
          htmlUrl: pr.htmlUrl,
          merge: pr.merge,
          stats: {
            totalFiles: pr.totalFileCount,
            filesWithPatch: pr.files.length,
            additions: pr.totalAdditions,
            deletions: pr.totalDeletions,
          },
          fileInventory: pr.allFiles,
          filesWithPatch: pr.files,
        },
      }),
    },
  ];

  try {
    const llmOut = await chatJson(messages, OutputSchema, {
      temperature: 0.2,
      maxTokens: 2000,
    });
    return enrichOutput(llmOut, pr);
  } catch (err) {
    if (err instanceof RateLimitError) {
      return fallback(input, "LLM rate limit reached", pr);
    }
    if (err instanceof Error && err.message.includes("LLM_API_KEY not set")) {
      return fallback(input, err.message, pr);
    }
    if (err instanceof z.ZodError) {
      return fallback(
        input,
        `LLM output invalid: ${err.issues[0]?.message ?? "schema mismatch"}`,
        pr,
      );
    }
    throw err;
  }
}
