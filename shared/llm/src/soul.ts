import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load the SOUL.md file that sits next to the caller's archetype folder.
// Resolves relative to the importing module's file URL.
export async function loadSoul(importMetaUrl: string): Promise<string> {
  const here = path.dirname(fileURLToPath(importMetaUrl));
  const soulPath = path.resolve(here, "../SOUL.md");
  return fs.readFile(soulPath, "utf8");
}
