import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, jobEvent } from "../src/job_decision.js";

const base = {
  job: "release", runId: "e8fb3667-3334-45e6-9b08-f6a92ebc42a1",
  buildId: "build_42", releaseId: "release_42"
};

test("failed release needs attention and groups by job and failure category", () => {
  const event = jobEvent.parse({ ...base, state: "failed", failure: "deployment" });
  const decision = decide(event);
  assert.equal(decision.capture, true);
  if (!decision.capture) throw new Error("Expected capture");
  assert.deepEqual(decision.fingerprint, ["release", "deployment"]);
  assert.equal(decision.state, "needs_attention");
});

test("successful run is not captured and a failed run requires a category", () => {
  const event = jobEvent.parse({ ...base, state: "succeeded" });
  assert.equal(decide(event).capture, false);
  assert.equal(jobEvent.safeParse({ ...base, state: "failed" }).success, false);
});
