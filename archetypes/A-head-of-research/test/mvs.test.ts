// Minimal MVS check — runs the handler with the canonical sample input and
// verifies the output matches the locked contract.
//
// Run via `npx foru test` (recommended) or directly with `tsx`.

import { RESEARCH_SAMPLE_INPUT, ResearchOutputSchema } from "@foru-workshop/contracts/src/research.js";
import { handle } from "../src/handler.js";

async function main(): Promise<void> {
  const output = await handle(RESEARCH_SAMPLE_INPUT);
  const parsed = ResearchOutputSchema.safeParse(output);
  if (!parsed.success) {
    console.error("MVS contract failed:", parsed.error.format());
    process.exit(1);
  }
  console.log("MVS PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
