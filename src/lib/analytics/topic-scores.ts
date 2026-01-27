export type TopicScoresV1 = {
  version: 1;
  computedAt: string;
  rule: "include_uncategorized";
  topics: Array<{
    topicId: string | null;
    topicName: string;
    obtained: number;
    total: number;
    percentage: number | null;
    questionCount: number;
  }>;
};

export function computeTopicScoresV1(input: {
  questions: Array<{
    id: string;
    marks: number;
    topicId: string | null;
    topicName?: string | null;
  }>;
  marksByQuestionId: Map<string, number>;
  computedAt?: Date;
}): TopicScoresV1 {
  const byTopic = new Map<string | null, { topicName: string; obtained: number; total: number; questionCount: number }>();

  for (const q of input.questions) {
    const key = q.topicId ?? null;
    const marksAwarded = input.marksByQuestionId.get(q.id) ?? 0;
    const current = byTopic.get(key) ?? {
      topicName: key === null ? "Uncategorized" : (q.topicName ?? "Topic"),
      obtained: 0,
      total: 0,
      questionCount: 0,
    };

    byTopic.set(key, {
      topicName: current.topicName,
      obtained: current.obtained + marksAwarded,
      total: current.total + q.marks,
      questionCount: current.questionCount + 1,
    });
  }

  const topics = Array.from(byTopic.entries()).map(([topicId, t]) => ({
    topicId,
    topicName: t.topicName,
    obtained: t.obtained,
    total: t.total,
    percentage: t.total > 0 ? (t.obtained / t.total) * 100 : null,
    questionCount: t.questionCount,
  }));

  topics.sort((a, b) => a.topicName.localeCompare(b.topicName));

  return {
    version: 1,
    computedAt: (input.computedAt ?? new Date()).toISOString(),
    rule: "include_uncategorized",
    topics,
  };
}

