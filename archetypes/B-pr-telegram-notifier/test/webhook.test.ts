import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  parsePushEvent,
  parsePullRequestEvent,
  shouldProcessPrAction,
  verifyGithubWebhookSignature,
} from "../src/github-webhook.js";

describe("github-webhook", () => {
  it("verifies valid sha256 signature", () => {
    const secret = "test-secret";
    const body = '{"action":"opened"}';
    const sig =
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    assert.equal(verifyGithubWebhookSignature(body, sig, secret), true);
  });

  it("rejects invalid signature", () => {
    assert.equal(
      verifyGithubWebhookSignature("{}", "sha256=deadbeef", "secret"),
      false,
    );
  });

  it("filters PR actions", () => {
    assert.equal(shouldProcessPrAction("opened"), true);
    assert.equal(shouldProcessPrAction("closed"), false);
  });

  it("parses push event branch", () => {
    const p = parsePushEvent("push", {
      ref: "refs/heads/feature-x",
      repository: { full_name: "org/repo" },
    });
    assert.ok(p);
    assert.equal(p.branch, "feature-x");
  });

  it("parses pull_request event", () => {
    const p = parsePullRequestEvent("pull_request", {
      action: "opened",
      pull_request: { html_url: "https://github.com/a/b/pull/1", number: 1 },
      repository: { full_name: "a/b" },
    });
    assert.ok(p);
  });
});
