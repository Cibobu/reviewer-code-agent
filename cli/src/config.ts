import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import {
  ARCHETYPES,
  isArchetypeCode,
  type ArchetypeCode,
} from "@foru-workshop/contracts";

const CONFIG_FILE = ".foru-config.json";

const ConfigSchema = z.object({
  archetype: z.string().refine(isArchetypeCode, "invalid archetype"),
  agentName: z.string().min(1).max(60),
  description: z.string().min(1).max(160),
  createdAt: z.string(),
});

export type WorkshopConfig = z.infer<typeof ConfigSchema>;

export function configPath(root: string = process.cwd()): string {
  return path.join(root, CONFIG_FILE);
}

export async function readConfig(): Promise<WorkshopConfig | null> {
  try {
    const raw = await fs.readFile(configPath(), "utf8");
    return ConfigSchema.parse(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function writeConfig(config: WorkshopConfig): Promise<void> {
  await fs.writeFile(configPath(), JSON.stringify(config, null, 2) + "\n");
}

export function archetypeFolder(code: ArchetypeCode): string {
  return path.join("archetypes", ARCHETYPES[code].folder);
}

export async function requireConfig(): Promise<WorkshopConfig> {
  const cfg = await readConfig();
  if (!cfg) {
    throw new Error(
      "No archetype selected yet. Run `npx foru choose` first.",
    );
  }
  return cfg;
}
