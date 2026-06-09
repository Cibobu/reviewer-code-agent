import { chatJson } from "@foru-workshop/llm";
import { z } from "zod";
import { ruleBasedScan, computeSecurityScore, type RuleFinding } from "./layer1-rules.js";

const AIReviewSchema = z.object({
  changeSummary: z.string(),
  securityScore: z.number().min(0).max(100),
  securitySeverity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
  impactAnalysis: z.object({
    affected: z.array(z.string()),
    potentialImpact: z.array(z.string()),
  }),
  codeQuality: z.object({
    maintainability: z.string(),
    recommendations: z.array(z.string()),
  }),
  contributors: z.array(
    z.object({
      username: z.string(),
      role: z.string(),
      commitCount: z.number().optional(),
    }),
  ),
  recommendations: z.object({
    mustFix: z.array(z.string()),
    recommended: z.array(z.string()),
    optional: z.array(z.string()),
  }),
});

export type AIReviewResult = z.infer<typeof AIReviewSchema>;

function severityFromScore(score: number): AIReviewResult["securitySeverity"] {
  if (score <= 40) return "CRITICAL";
  if (score <= 60) return "HIGH";
  if (score <= 80) return "MEDIUM";
  return "LOW";
}

function buildFallbackReview(
  input: PipelineInput,
  ruleFindings: RuleFinding[],
  ruleScore: number,
): AIReviewResult {
  const severity = ruleFindings.some((f) => f.severity === "CRITICAL")
    ? "CRITICAL"
    : ruleFindings.some((f) => f.severity === "HIGH")
      ? "HIGH"
      : severityFromScore(ruleScore);
  const eventLabel = `${input.eventType}${input.action ? `.${input.action}` : ""}`;
  const fileList = input.files.map((f) => f.filename).slice(0, 10);

  return {
    changeSummary: input.files.length
      ? `Analyzed ${input.files.length} changed file(s) for ${eventLabel} on ${input.repository}. ${ruleFindings.length} rule finding(s).`
      : `${eventLabel} on ${input.repository}${input.title ? `: ${input.title}` : ""}. No file diff available.`,
    securityScore: ruleScore,
    securitySeverity: severity,
    impactAnalysis: {
      affected: fileList.length ? fileList : [input.repository],
      potentialImpact: ruleFindings.length
        ? ruleFindings.map((f) => f.title).slice(0, 5)
        : ["No automated rule violations detected"],
    },
    codeQuality: {
      maintainability: input.files.length ? `${input.files.length} file(s) changed` : "No diff captured",
      recommendations: ruleFindings.length
        ? ["Address rule findings before merge"]
        : ["Review changes manually if needed"],
    },
    contributors: input.author ? [{ username: input.author, role: "author" }] : [],
    recommendations: {
      mustFix: ruleFindings
        .filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH")
        .map((f) => f.title),
      recommended: ruleFindings.filter((f) => f.severity === "MEDIUM").map((f) => f.title),
      optional: [],
    },
  };
}

export interface PipelineInput {
  repository: string;
  eventType: string;
  action?: string;
  title?: string;
  author?: string;
  files: { filename: string; status: string; patch?: string; additions?: number; deletions?: number }[];
  baseBranch?: string;
  headBranch?: string;
}

const SYSTEM_PROMPT = `You are GitGuardian AI — a DevSecOps code reviewer.
Analyze ONLY the provided diff snippets. Never invent files.
Return strict JSON matching the schema. Be concise to save tokens.`;

/** Layers 1+2: rules first, then LLM on diff snippets only. */
export async function runAnalysisPipeline(
  input: PipelineInput,
): Promise<{ review: AIReviewResult; ruleFindings: RuleFinding[]; tokensUsed: number }> {
  const ruleFindings = ruleBasedScan(input.files);
  const ruleScore = computeSecurityScore(ruleFindings);

  const diffPayload = input.files
    .filter((f) => f.patch)
    .slice(0, 15)
    .map((f) => ({
      filename: f.filename,
      status: f.status,
      patch: (f.patch ?? "").slice(0, 3000),
    }));

  const userContent = JSON.stringify({
    repository: input.repository,
    event: `${input.eventType}${input.action ? `.${input.action}` : ""}`,
    title: input.title,
    author: input.author,
    branches: input.baseBranch && input.headBranch ? `${input.headBranch} → ${input.baseBranch}` : undefined,
    ruleFindings: ruleFindings.slice(0, 10),
    ruleSecurityScore: ruleScore,
    changedFiles: diffPayload,
  });

  let review: AIReviewResult;
  let tokensUsed = 0;

  try {
    review = await chatJson(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      AIReviewSchema,
      { temperature: 0.2, maxTokens: 1200 },
    );
    tokensUsed = 1200;
  } catch {
    review = buildFallbackReview(input, ruleFindings, ruleScore);
  }

  if (ruleFindings.some((f) => f.severity === "CRITICAL")) {
    review.securityScore = Math.min(review.securityScore, ruleScore);
    review.securitySeverity = "CRITICAL";
  }

  return { review, ruleFindings, tokensUsed };
}

export { ruleBasedScan, computeSecurityScore };
