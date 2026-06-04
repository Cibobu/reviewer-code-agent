import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { redactLine, scanText, shouldScanFile } from "./scan.js";

describe("scan", () => {
  it("detects api key assignments", () => {
    const hits = scanText('API_KEY=sk-abcdefghijklmnop', "config.ts");
    assert.ok(hits.length >= 1);
    assert.equal(hits[0].kind, "api_key_assignment");
  });

  it("redacts secrets in previews", () => {
    const redacted = redactLine('TOKEN=supersecret123');
    assert.match(redacted, /\[REDACTED\]/);
    assert.doesNotMatch(redacted, /supersecret123/);
  });

  it("skips node_modules paths", () => {
    assert.equal(shouldScanFile("node_modules/pkg/index.js"), false);
    assert.equal(shouldScanFile("src/app.ts"), true);
  });
});
