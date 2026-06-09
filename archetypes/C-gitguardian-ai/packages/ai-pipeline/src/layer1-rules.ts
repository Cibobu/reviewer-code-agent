export const SECRET_PATTERNS: { category: string; pattern: RegExp; severity: "CRITICAL" | "HIGH" | "MEDIUM" }[] = [
  { category: "hardcoded_secret", pattern: /\b(API_KEY|SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=\s*\S+/i, severity: "CRITICAL" },
  { category: "openai_key", pattern: /\bsk-[a-zA-Z0-9_-]{8,}\b/, severity: "CRITICAL" },
  { category: "sql_injection", pattern: /(\$\{|\+\s*).*?(SELECT|INSERT|UPDATE|DELETE).*?/i, severity: "HIGH" },
  { category: "xss", pattern: /dangerouslySetInnerHTML|innerHTML\s*=|document\.write/i, severity: "HIGH" },
  { category: "eval", pattern: /\beval\s*\(/, severity: "CRITICAL" },
  { category: "csrf_missing", pattern: /fetch\s*\([^)]*\{[^}]*(?!credentials)/i, severity: "MEDIUM" },
];

export interface RuleFinding {
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  filePath: string;
  lineHint: string;
}

/** Layer 1 — rule-based scan (no LLM). */
export function ruleBasedScan(
  files: { filename: string; patch?: string }[],
): RuleFinding[] {
  const findings: RuleFinding[] = [];
  for (const file of files) {
    const patch = file.patch ?? "";
    if (!patch) continue;
    const lines = patch.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.startsWith("+")) continue;
      for (const rule of SECRET_PATTERNS) {
        if (rule.pattern.test(line)) {
          findings.push({
            category: rule.category,
            severity: rule.severity,
            title: `${rule.category.replace(/_/g, " ")} in ${file.filename}`,
            filePath: file.filename,
            lineHint: `~${i + 1}`,
          });
          break;
        }
      }
    }
  }
  return findings;
}

export function computeSecurityScore(findings: RuleFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === "CRITICAL") score -= 25;
    else if (f.severity === "HIGH") score -= 15;
    else if (f.severity === "MEDIUM") score -= 8;
    else score -= 3;
  }
  return Math.max(0, Math.min(100, score));
}
