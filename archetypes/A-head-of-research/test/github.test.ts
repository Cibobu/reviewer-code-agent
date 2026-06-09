import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitHubPrError, parsePrUrl } from "../src/github.js";
import { validateGitHubPrUrl } from "@foru-workshop/contracts/src/research.js";

describe("GitHub PR URL", () => {
  it("accepts valid github PR url", () => {
    assert.equal(
      validateGitHubPrUrl("https://github.com/facebook/react/pull/123").valid,
      true,
    );
    const p = parsePrUrl("https://github.com/facebook/react/pull/123");
    assert.deepEqual(p, { owner: "facebook", repo: "react", number: 123 });
  });

  it("rejects non-github host", () => {
    const r = validateGitHubPrUrl("https://gitlab.com/a/b/-/merge_requests/1");
    assert.equal(r.valid, false);
    assert.throws(
      () => parsePrUrl("https://gitlab.com/a/b/pull/1"),
      GitHubPrError,
    );
  });

  it("rejects wrong path format", () => {
    const r = validateGitHubPrUrl("https://github.com/facebook/react/issues/123");
    assert.equal(r.valid, false);
  });
});
