import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ARCHETYPES,
  CONTRACTS,
  type ArchetypeCode,
} from "@foru-workshop/contracts";
import { archetypeFolder, requireConfig } from "../config.js";
import { c, fail, heading, info, ok } from "../ui.js";

export async function testCommand(): Promise<void> {
  const cfg = await requireConfig();
  const code = cfg.archetype as ArchetypeCode;
  const meta = ARCHETYPES[code];

  heading(`MVS test — ${code} (${meta.role})`);

  const handlerPath = path.resolve(
    process.cwd(),
    archetypeFolder(code),
    "src/handler.ts",
  );
  const handlerUrl = pathToFileURL(handlerPath).href;

  let handler: (input: unknown) => Promise<unknown>;
  try {
    const mod = await import(handlerUrl);
    handler = mod.handle ?? mod.default;
    if (typeof handler !== "function") {
      fail(`handler.ts must export a 'handle' function. None found.`);
      process.exitCode = 1;
      return;
    }
  } catch (err) {
    fail(`Could not load ${handlerPath}: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const contract = CONTRACTS[code];
  const sample = contract.sample;
  info(`Input  ${c.dim}(sample)${c.reset}: ${JSON.stringify(sample)}`);

  let output: unknown;
  try {
    output = await handler(sample);
  } catch (err) {
    fail(`Brain threw: ${(err as Error).message}`);
    process.exitCode = 1;
    return;
  }

  const parsed = contract.output.safeParse(output);
  if (!parsed.success) {
    fail("Output does NOT match the MVS contract.");
    for (const issue of parsed.error.issues) {
      console.log(`    · ${issue.path.join(".") || "(root)"} — ${issue.message}`);
    }
    process.exitCode = 1;
    return;
  }

  ok("Output matches the MVS contract.");
  console.log(`${c.dim}${JSON.stringify(parsed.data, null, 2)}${c.reset}`);
  info("Ready to ship. Run `npx foru submit`.");
}
