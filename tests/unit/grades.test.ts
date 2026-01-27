import test from "node:test";
import assert from "node:assert/strict";
import { calculateGradeFromMarks } from "../../src/lib/grades";

test("calculateGradeFromMarks: returns expected grade bands", () => {
  assert.equal(calculateGradeFromMarks(90, 100), "A+");
  assert.equal(calculateGradeFromMarks(80, 100), "A");
  assert.equal(calculateGradeFromMarks(70, 100), "B");
  assert.equal(calculateGradeFromMarks(60, 100), "C");
  assert.equal(calculateGradeFromMarks(50, 100), "D");
  assert.equal(calculateGradeFromMarks(49.9, 100), "F");
});

