export * from "./archetypes.js";
export * as A from "./research.js";
export * as B from "./notifier.js";

import type { z } from "zod";
import * as A from "./research.js";
import * as B from "./notifier.js";
import type { ArchetypeCode } from "./archetypes.js";

interface ContractEntry<I = unknown, O = unknown> {
  input: z.ZodType<I>;
  output: z.ZodType<O, z.ZodTypeDef, unknown>;
  sample: I;
}

export const CONTRACTS = {
  A: {
    input: A.ResearchInputSchema,
    output: A.ResearchOutputSchema,
    sample: A.RESEARCH_SAMPLE_INPUT,
  },
  B: {
    input: B.NotifierInputSchema,
    output: B.NotifierOutputSchema,
    sample: B.NOTIFIER_SAMPLE_INPUT,
  },
} as const satisfies Record<ArchetypeCode, ContractEntry>;
