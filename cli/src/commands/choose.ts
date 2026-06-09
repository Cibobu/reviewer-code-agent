import {
  ARCHETYPES,
  isArchetypeCode,
  type ArchetypeCode,
} from "@foru-workshop/contracts";
import {
  archetypeFolder,
  readConfig,
  writeConfig,
} from "../config.js";
import { c, heading, info, ok, prompt, warn } from "../ui.js";

export async function chooseCommand(arg?: string): Promise<void> {
  const existing = await readConfig();
  if (existing) {
    warn(
      `You already chose ${existing.archetype} — ${ARCHETYPES[existing.archetype as ArchetypeCode].role}.`,
    );
    const confirm = await prompt("Re-pick? This wipes your config. [y/N] ");
    if (confirm.toLowerCase() !== "y") {
      info("Keeping existing pick.");
      return;
    }
  }

  const code: ArchetypeCode =
    arg && isArchetypeCode(arg.toUpperCase()) ? (arg.toUpperCase() as ArchetypeCode) : "A";

  const meta = ARCHETYPES[code];
  const defaultName = code === "B" ? "GitHub Review Bot" : "PR Risk Scanner";
  const agentName = await prompt(
    `Agent name (max 60 chars) [${defaultName}]: `,
  );
  const description = await prompt(
    "One-line description (max 160 chars): ",
  );

  await writeConfig({
    archetype: code,
    agentName: agentName || defaultName,
    description: description || `${meta.role} — ${meta.problem}`,
    createdAt: new Date().toISOString(),
  });

  ok(`Picked ${c.bold}${code} — ${meta.role}${c.reset}.`);
  info(`Edit persona: ${c.cyan}${archetypeFolder(code)}/SOUL.md${c.reset}`);
  info(`Then: ${c.cyan}npx foru test${c.reset}, then ${c.cyan}npx foru submit${c.reset}`);
}
