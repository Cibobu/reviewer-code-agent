#!/usr/bin/env -S npx tsx
import { chooseCommand } from "./commands/choose.js";
import { statusCommand } from "./commands/status.js";
import { testCommand } from "./commands/test.js";
import { submitCommand } from "./commands/submit.js";
import { closePrompts } from "./ui.js";

const COMMANDS = {
  choose: chooseCommand,
  status: statusCommand,
  test: testCommand,
  submit: submitCommand,
} as const;

type CommandName = keyof typeof COMMANDS;

function printHelp(): void {
  console.log(`
foru — PR Risk Scanner CLI

Usage:
  npx foru choose [A]     pick archetype (defaults to A)
  npx foru status           show config and edit paths
  npx foru test             run brain against MVS contract
  npx foru submit           test, then deploy to FORU Grid

Typical flow:  choose → (edit SOUL.md) → test → submit
`);
}

async function main(): Promise<void> {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || name === "--help" || name === "-h") {
    printHelp();
    return;
  }
  const command = COMMANDS[name as CommandName];
  if (!command) {
    console.error(`Unknown command: ${name}`);
    printHelp();
    process.exitCode = 1;
    return;
  }
  try {
    await command(...(rest as [string?]));
  } catch (err) {
    console.error(`\n✗ ${(err as Error).message}`);
    process.exitCode = 1;
  } finally {
    closePrompts();
  }
}

main();
