import { z } from "zod";
import {
  PrScannerOutputCoreSchema,
  PrScannerInputSchema,
  validateGitHubPrUrl,
} from "./research.js";

export const BranchCompareInputSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  base: z.string().min(1),
  head: z.string().min(1),
});

/** Manual invoke, webhook, or Telegram-triggered scan for archetype B. */
export const NotifierInputSchema = z
  .object({
    scanType: z.enum(["pr", "branch_compare"]).default("pr"),
    prUrl: z.string().url().optional(),
    branchCompare: BranchCompareInputSchema.optional(),
    githubToken: z.string().optional(),
    demoDiff: PrScannerInputSchema.shape.demoDiff,
    dryRun: z.boolean().optional(),
    /** Target Telegram chat (defaults to env TELEGRAM_CHAT_ID). */
    telegramChatId: z.string().optional(),
    webhook: z
      .object({
        deliveryId: z.string(),
        event: z.string(),
        action: z.string(),
        repository: z.string(),
        prNumber: z.number().optional(),
        branch: z.string().optional(),
      })
      .optional(),
  })
  .superRefine((val, ctx) => {
    if (val.scanType === "pr") {
      if (!val.prUrl && !val.demoDiff) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "prUrl required for PR scan (or use demoDiff)",
          path: ["prUrl"],
        });
        return;
      }
      if (val.prUrl) {
        const check = validateGitHubPrUrl(val.prUrl);
        if (!check.valid) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: check.message,
            path: ["prUrl"],
          });
        }
      }
    }
    if (val.scanType === "branch_compare" && !val.branchCompare && !val.demoDiff) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "branchCompare required for branch scan",
        path: ["branchCompare"],
      });
    }
  });

export const NotifierOutputSchema = z.object({
  delivered: z.boolean(),
  chatId: z.string(),
  messageText: z.string(),
  telegramMessageId: z.number().optional(),
  skippedReason: z.string().optional(),
  scanType: z.enum(["pr", "branch_compare"]),
  review: PrScannerOutputCoreSchema,
});

export type NotifierInput = z.infer<typeof NotifierInputSchema>;
export type NotifierOutput = z.infer<typeof NotifierOutputSchema>;
export type BranchCompareInput = z.infer<typeof BranchCompareInputSchema>;

export const NOTIFIER_SAMPLE_INPUT: NotifierInput = {
  scanType: "pr",
  prUrl: "https://github.com/demo/acme-api/pull/42",
  dryRun: true,
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
          "+   const secret = 'sk_live_hardcoded';\n" +
          "+   eval(req.body.payload);\n" +
          "+ }",
      },
    ],
  },
};

export const NOTIFIER_BRANCH_SAMPLE: NotifierInput = {
  scanType: "branch_compare",
  dryRun: true,
  branchCompare: {
    owner: "demo",
    repo: "acme-api",
    base: "main",
    head: "feature/payments",
  },
  demoDiff: {
    title: "feature/payments → main",
    body: "Branch compare demo",
    files: [
      {
        filename: "src/payments.ts",
        status: "added",
        additions: 40,
        deletions: 0,
        patch: "+ export const API_KEY = 'leaked';",
      },
    ],
  },
};
