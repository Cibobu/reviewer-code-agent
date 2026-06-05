// Calibration harness — runs archetype A brain and prints output for review.
//
//   npx tsx --env-file=.env scripts/calibrate.ts

import { brain } from "../archetypes/A-head-of-research/src/brain.js";
import { CONTRACTS } from "@foru-workshop/contracts";

const ASCII_RULE = "─".repeat(72);

function fmtJson(v: unknown): string {
  return JSON.stringify(v, null, 2);
}

async function main(): Promise<void> {
  if (!process.env.LLM_API_KEY) {
    console.warn("LLM_API_KEY not set — brain will use fallback heuristics");
  }

  const sample = CONTRACTS.A.sample;
  console.log(`\n${ASCII_RULE}\n  A · PR Risk Scanner\n${ASCII_RULE}`);
  console.log("input:");
  console.log(fmtJson(sample));
  console.log("\nrunning brain…");

  const started = Date.now();
  try {
    const out = await brain(sample);
    console.log(`output (${Date.now() - started}ms):`);
    console.log(fmtJson(out));
  } catch (err) {
    console.log(`ERROR (${Date.now() - started}ms):`);
    console.log(err instanceof Error ? err.stack ?? err.message : String(err));
    process.exit(1);
  }

  console.log(`\n${ASCII_RULE}\n  done\n${ASCII_RULE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
