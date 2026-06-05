import {
  ARCHETYPES,
  type ArchetypeCode,
} from "@foru-workshop/contracts";
import { archetypeFolder, readConfig } from "../config.js";
import { c, dim, heading, info, warn } from "../ui.js";

export async function statusCommand(): Promise<void> {
  const cfg = await readConfig();
  heading("Workshop status");
  if (!cfg) {
    warn("No archetype selected. Run `npx foru choose`.");
    return;
  }
  const meta = ARCHETYPES[cfg.archetype as ArchetypeCode];
  console.log(`  Archetype:    ${c.bold}${cfg.archetype}${c.reset} — ${meta.role}`);
  console.log(`  Problem:      ${meta.problem}`);
  console.log(`  Agent name:   ${cfg.agentName}`);
  console.log(`  Description:  ${cfg.description}`);
  console.log(`  Brain file:   ${c.cyan}${archetypeFolder(cfg.archetype as ArchetypeCode)}/src/brain.ts${c.reset}`);
  console.log(dim(`  Picked at:    ${cfg.createdAt}`));
  info("Next: edit brain.ts → `npx foru test` → `npx foru submit`.");
}
