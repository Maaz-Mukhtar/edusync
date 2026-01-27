import test from "node:test";
import assert from "node:assert/strict";
import { parseAnalyticsPeriodFilters } from "../../src/lib/analytics/filters";

test("analytics filters: termId omitted => null (all terms)", () => {
  const parsed = parseAnalyticsPeriodFilters({ academicYearId: "y1" });
  assert.deepEqual(parsed, { academicYearId: "y1", termId: null });
});

test("analytics filters: termId=all => null (all terms)", () => {
  const parsed = parseAnalyticsPeriodFilters({ academicYearId: "y1", termId: "all" });
  assert.deepEqual(parsed, { academicYearId: "y1", termId: null });
});

test("analytics filters: trims and keeps specific termId", () => {
  const parsed = parseAnalyticsPeriodFilters({ academicYearId: "  y1 ", termId: "  t1 " });
  assert.deepEqual(parsed, { academicYearId: "y1", termId: "t1" });
});

test("analytics filters: empty academicYearId => null", () => {
  const parsed = parseAnalyticsPeriodFilters({ academicYearId: "   ", termId: "all" });
  assert.deepEqual(parsed, { academicYearId: null, termId: null });
});
