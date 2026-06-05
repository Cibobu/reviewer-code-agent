export * from "./archetypes.js";
export * as A from "./research.js";

import type { z } from "zod";
import * as A from "./research.js";
import type { ArchetypeCode } from "./archetypes.js";

interface ContractEntry<I = unknown, O = unknown> {
  input: z.ZodType<I>;
  output: z.ZodType<O, z.ZodTypeDef, unknown>;
  sample: I;
}

export const CONTRACTS: Record<
  ArchetypeCode,
  ContractEntry<A.ResearchInput, A.ResearchOutput>
> = {
  A: {
    input: A.ResearchInputSchema,
    output: A.ResearchOutputSchema,
    sample: A.RESEARCH_SAMPLE_INPUT,
  },
};
