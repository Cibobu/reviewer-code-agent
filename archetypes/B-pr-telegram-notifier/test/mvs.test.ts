import { NOTIFIER_SAMPLE_INPUT, NotifierOutputSchema } from "@foru-workshop/contracts/src/notifier.js";
import { handle } from "../src/handler.js";

async function main(): Promise<void> {
  const output = await handle(NOTIFIER_SAMPLE_INPUT);
  const parsed = NotifierOutputSchema.safeParse(output);
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
