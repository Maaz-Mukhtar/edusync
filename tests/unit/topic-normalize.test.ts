import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTopicName } from "../../src/lib/topics/normalize";

test("normalizeTopicName: trims, collapses spaces, lowercases", () => {
  assert.equal(normalizeTopicName("  Algebra   Basics "), "algebra basics");
});

