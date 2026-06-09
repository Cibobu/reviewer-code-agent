export const ARCHETYPES = {
  A: {
    code: "A",
    role: "PR Risk Scanner",
    problem: "P1 — PR code review & risk assessment",
    folder: "A-head-of-research",
  },
  B: {
    code: "B",
    role: "GitHub Review Bot",
    problem: "P2 — Telegram bot: PR + branch review via GitHub webhook",
    folder: "B-pr-telegram-notifier",
  },
  C: {
    code: "C",
    role: "GitGuardian AI",
    problem: "P3 — SaaS GitHub monitoring, AI review, dashboard & Telegram",
    folder: "C-gitguardian-ai",
  },
} as const;

export type ArchetypeCode = keyof typeof ARCHETYPES;
export const ARCHETYPE_CODES: ArchetypeCode[] = ["A", "B", "C"];

export function isArchetypeCode(value: string): value is ArchetypeCode {
  return (ARCHETYPE_CODES as string[]).includes(value);
}
