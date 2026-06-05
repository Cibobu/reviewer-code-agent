import * as readline from "node:readline/promises";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

export const c = COLORS;

export function ok(msg: string): void {
  console.log(`${COLORS.green}✓${COLORS.reset} ${msg}`);
}

export function fail(msg: string): void {
  console.log(`${COLORS.red}✗${COLORS.reset} ${msg}`);
}

export function info(msg: string): void {
  console.log(`${COLORS.cyan}ℹ${COLORS.reset} ${msg}`);
}

export function warn(msg: string): void {
  console.log(`${COLORS.yellow}!${COLORS.reset} ${msg}`);
}

export function heading(msg: string): void {
  console.log(`\n${COLORS.bold}${msg}${COLORS.reset}`);
}

export function dim(msg: string): string {
  return `${COLORS.dim}${msg}${COLORS.reset}`;
}

let sharedRl: readline.Interface | null = null;

function rl(): readline.Interface {
  if (!sharedRl) {
    sharedRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return sharedRl;
}

export async function prompt(question: string): Promise<string> {
  const answer = await rl().question(question);
  return answer.trim();
}

export function closePrompts(): void {
  sharedRl?.close();
  sharedRl = null;
}
