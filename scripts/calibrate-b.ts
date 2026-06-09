// Calibration harness — runs archetype B brain (dryRun by default).
//
//   npm run calibrate:b

import { brain } from "../archetypes/B-pr-telegram-notifier/src/brain.js";
import { CONTRACTS } from "@foru-workshop/contracts";

const RULE = "─".repeat(72);

async function main(): Promise<void> {
  const sample = { ...CONTRACTS.B.sample, dryRun: true };
  console.log(`\n${RULE}\n  B · PR Telegram Notifier (dryRun)\n${RULE}`);
  console.log("input:", JSON.stringify(sample, null, 2));
  console.log("\nrunning brain…");

  const started = Date.now();
  try {
    const out = await brain(sample);
    console.log(`output (${Date.now() - started}ms):`);
    console.log(JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(err instanceof Error ? err.stack ?? err.message : err);
    process.exit(1);
  }
  console.log(`\n${RULE}\n  done\n${RULE}`);
}

main();
