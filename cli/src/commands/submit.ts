import path from "node:path";
import { ARCHETYPES, type ArchetypeCode } from "@foru-workshop/contracts";
import { buildManifest, formatHandoff } from "@foru-workshop/grid";
import { archetypeFolder, requireConfig } from "../config.js";
import { c, fail, heading, info, ok } from "../ui.js";
import { testCommand } from "./test.js";

export async function submitCommand(): Promise<void> {
  const cfg = await requireConfig();
  const code = cfg.archetype as ArchetypeCode;
  const meta = ARCHETYPES[code];

  heading(`Submit — ${code} (${meta.role})`);

  info("Step 1/2 — run MVS test locally");
  await testCommand();
  if (process.exitCode === 1) {
    fail("Fix the contract failures above before submitting.");
    return;
  }

  info("Step 2/2 — hand off to OpenClaw / facilitator");
  const folder = archetypeFolder(code);
  const manifest = buildManifest({
    archetype: code,
    agentName: cfg.agentName,
    description: cfg.description,
    entrypoint: path.join(folder, "src/handler.ts"),
    soulPath: path.join(folder, "SOUL.md"),
  });

  ok("Your agent is ready to deploy.");
  console.log();
  console.log(formatHandoff(manifest));
  console.log();
  info("To deploy via OpenClaw, send this message to your OpenClaw chat:");
  console.log(
    `${c.cyan}\n   Wrap ${manifest.entrypoint} as a FORU Grid agent for archetype ${code}, ` +
      `deploy it, and return the callable URL.\n${c.reset}`,
  );
  info(
    "Hand the manifest above to a facilitator or register on FORU Grid.",
  );
}
