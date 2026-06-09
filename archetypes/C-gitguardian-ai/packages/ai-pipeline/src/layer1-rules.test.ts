import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ruleBasedScan, computeSecurityScore } from "./layer1-rules.js";

describe("layer1-rules", () => {
  it("detects hardcoded API keys", () => {
    const findings = ruleBasedScan([
      {
        filename: "payment.service.ts",
        status: "modified",
        patch: '+const API_KEY = "sk-live-abc123secretkey"',
      },
    ]);
    assert.ok(findings.length > 0);
    assert.equal(findings[0].severity, "CRITICAL");
  });

  it("computes lower score for critical findings", () => {
    const score = computeSecurityScore([
      { severity: "CRITICAL", category: "secrets", title: "key", filePath: "a.ts" },
      { severity: "CRITICAL", category: "secrets", title: "key2", filePath: "b.ts" },
    ]);
    assert.equal(score, 50);
  });
});
