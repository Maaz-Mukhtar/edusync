import test from "node:test";
import assert from "node:assert/strict";
import { computeTopicScoresV1 } from "../../src/lib/analytics/topic-scores";

test("computeTopicScoresV1: groups by topic and includes Uncategorized", () => {
  const marksByQuestionId = new Map<string, number>([
    ["q1", 1],
    ["q2", 0],
    ["q3", 2],
  ]);

  const scores = computeTopicScoresV1({
    questions: [
      { id: "q1", marks: 2, topicId: "t1", topicName: "Fractions" },
      { id: "q2", marks: 1, topicId: "t1", topicName: "Fractions" },
      { id: "q3", marks: 2, topicId: null, topicName: null },
    ],
    marksByQuestionId,
    computedAt: new Date("2026-01-27T00:00:00.000Z"),
  });

  assert.equal(scores.version, 1);
  assert.equal(scores.rule, "include_uncategorized");
  assert.equal(scores.computedAt, "2026-01-27T00:00:00.000Z");

  const fractions = scores.topics.find((t) => t.topicId === "t1");
  const uncategorized = scores.topics.find((t) => t.topicId === null);

  assert.deepEqual(fractions, {
    topicId: "t1",
    topicName: "Fractions",
    obtained: 1,
    total: 3,
    percentage: (1 / 3) * 100,
    questionCount: 2,
  });

  assert.deepEqual(uncategorized, {
    topicId: null,
    topicName: "Uncategorized",
    obtained: 2,
    total: 2,
    percentage: 100,
    questionCount: 1,
  });
});

