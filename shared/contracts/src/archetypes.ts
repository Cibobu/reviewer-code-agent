export const ARCHETYPES = {
  A: {
    code: "A",
    role: "PR Risk Scanner",
    problem: "P1 — PR code review & risk assessment",
    folder: "A-head-of-research",
  },
} as const;

export type ArchetypeCode = keyof typeof ARCHETYPES;
export const ARCHETYPE_CODES: ArchetypeCode[] = ["A"];

export function isArchetypeCode(value: string): value is ArchetypeCode {
  return (ARCHETYPE_CODES as string[]).includes(value);
}
