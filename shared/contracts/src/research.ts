import { z } from "zod";

/** LLMs sometimes return a string where the contract expects string[]. */
function coerceStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((item) => String(item));
  if (val == null || val === "") return [];
  if (typeof val === "string") return [val];
  return [String(val)];
}

const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

function normalizeRiskLevel(val: unknown): (typeof RISK_LEVELS)[number] {
  const s = typeof val === "string" ? val.toLowerCase().trim() : "medium";
  return (RISK_LEVELS as readonly string[]).includes(s)
    ? (s as (typeof RISK_LEVELS)[number])
    : "medium";
}

const FileChangedSchema = z.object({
  filename: z.string(),
  status: z.string(),
  additions: z.coerce.number(),
  deletions: z.coerce.number(),
  summary: z.string(),
});

function normalizeFilesChanged(val: unknown): z.infer<typeof FileChangedSchema>[] {
  if (!Array.isArray(val)) return [];
  return val.map((item) => {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      return {
        filename: String(o.filename ?? ""),
        status: String(o.status ?? "changed"),
        additions: Number(o.additions ?? 0),
        deletions: Number(o.deletions ?? 0),
        summary: String(o.summary ?? ""),
      };
    }
    return {
      filename: String(item),
      status: "changed",
      additions: 0,
      deletions: 0,
      summary: "",
    };
  });
}

/** Strict output shape — used for TypeScript types and final validation. */
const PrScannerOutputCoreSchema = z.object({
  summary: z.string(),
  riskLevel: z.enum(RISK_LEVELS),
  mergeStatus: z.string(),
  filesChanged: z.array(FileChangedSchema),
  conflictNotes: z.array(z.string()),
  conflictResolution: z.string(),
  issuesFound: z.array(z.string()),
  securityNotes: z.array(z.string()),
  missingTests: z.array(z.string()),
  effectIfMerged: z.string(),
  recommendedNextAction: z.string(),
});

function normalizePrScannerOutput(raw: unknown): z.input<typeof PrScannerOutputCoreSchema> {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    summary: String(o.summary ?? ""),
    riskLevel: normalizeRiskLevel(o.riskLevel),
    mergeStatus: String(o.mergeStatus ?? ""),
    filesChanged: normalizeFilesChanged(o.filesChanged),
    conflictNotes: coerceStringArray(o.conflictNotes),
    conflictResolution: String(o.conflictResolution ?? ""),
    issuesFound: coerceStringArray(o.issuesFound),
    securityNotes: coerceStringArray(o.securityNotes),
    missingTests: coerceStringArray(o.missingTests),
    effectIfMerged: String(o.effectIfMerged ?? ""),
    recommendedNextAction: String(o.recommendedNextAction ?? ""),
  };
}

/** Accepts loose LLM JSON, normalizes, then validates against the core schema. */
export const PrScannerOutputSchema = z.preprocess(
  normalizePrScannerOutput,
  PrScannerOutputCoreSchema,
);

export const PrScannerInputSchema = z.object({
  prUrl: z.string().url(),
  githubToken: z.string().optional(),
  /** Skip GitHub API — use synthetic demo diff (offline / workshop demo) */
  demoDiff: z
    .object({
      title: z.string(),
      body: z.string().optional(),
      merge: z
        .object({
          mergeable: z.boolean().nullable(),
          mergeableState: z.string(),
          baseBranch: z.string(),
          headBranch: z.string(),
          hasConflicts: z.boolean(),
        })
        .optional(),
      files: z.array(
        z.object({
          filename: z.string(),
          status: z.string(),
          additions: z.number().optional(),
          deletions: z.number().optional(),
          patch: z.string().optional(),
        }),
      ),
    })
    .optional(),
});

export type PrScannerInput = z.infer<typeof PrScannerInputSchema>;
export type PrScannerOutput = z.infer<typeof PrScannerOutputCoreSchema>;
export type FileChanged = z.infer<typeof FileChangedSchema>;

export const ResearchInputSchema = PrScannerInputSchema;
export const ResearchOutputSchema = PrScannerOutputSchema;
export type ResearchInput = PrScannerInput;
export type ResearchOutput = PrScannerOutput;

export const RESEARCH_SAMPLE_INPUT: PrScannerInput = {
  prUrl: "https://github.com/demo/acme-api/pull/42",
  demoDiff: {
    title: "Add payment webhook handler",
    body: "Implements Stripe webhook verification",
    files: [
      {
        filename: "src/webhook.ts",
        status: "added",
        additions: 28,
        deletions: 0,
        patch:
          "+ export function handleWebhook(req: Request) {\n" +
          "+   const secret = 'sk_live_hardcoded'; // TODO: move to env\n" +
          "+   if (!req.body) return { ok: true };\n" +
          "+   eval(req.body.payload);\n" +
          "+ }",
      },
      {
        filename: "src/webhook.test.ts",
        status: "removed",
        additions: 0,
        deletions: 45,
        patch: "- describe('webhook', () => { ... });",
      },
    ],
  },
};
