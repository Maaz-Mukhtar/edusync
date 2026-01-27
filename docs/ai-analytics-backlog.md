# AI Analytics & AI Practice Tests — Backlog + Ticket Runner

This document defines a phase-by-phase implementation plan and a ticketing workflow for Codex agents.

See also:
- `docs/ai/analytics-filter-contract.md` (canonical year/term analytics filtering contract)

Scope highlights based on current product decisions:

- Topic taxonomy is **both** admin-defined (baseline) and teacher-defined (extensions).
- Teachers create assessments on-platform (questions exist), can print, then enter **per-question marks**.
- MCQ grading is **all-or-nothing** (no partial credit for MCQ).
- Parent practice tests can be shared to teachers **only if the parent opts in**.
- AI insights are visible to **parents for their own children only**.

---

# Ticket Runner Checklist

**Purpose:** This checklist must be followed by the Codex agent for **every single ticket** in the backlog.

---

## The 9-Step Process

Repeat this exact sequence for each ticket:

---

### Step 1: Read the Ticket

- [ ] Read the ticket file fully
- [ ] Understand the Goal and Non-Goals
- [ ] Review all Work Items
- [ ] Note the Dependencies
- [ ] Review Acceptance Criteria

---

### Step 2: Create Branch

```bash
git checkout -b ticket/T-###-short-name
```

**Naming convention:** `ticket/T-000-setup`, `ticket/T-110-auth-v1`, etc.

---

### Step 3: Implement Work Items

- [ ] Complete each work item in order
- [ ] Stay within ticket scope (no feature creep!)
- [ ] Follow Operating Rules from Agent Playbook

---

### Step 4: Add/Update Tests

- [ ] Add unit tests for new functions
- [ ] Add integration tests for critical paths
- [ ] Ensure existing tests still pass

---

### Step 5: Run Verification Commands

- [ ] Execute each verification command from the ticket
- [ ] All commands must return "PASS"
- [ ] Document any issues found

---

### Step 6: Fix Until Green

- [ ] All linting passes
- [ ] All type checking passes
- [ ] All tests pass
- [ ] All verification commands pass

```bash
# Standard quality check sequence
npm run lint
npx tsc -p tsconfig.json --noEmit
npm run test:perf
```

---

### Step 7: Update Docs

- [ ] Update files listed in "Docs to Update" section
- [ ] Update README if behavior changed
- [ ] Update ARCHITECTURE.md if structure changed (create if missing)

---

### Step 8: Add Changelog Note

- [ ] Add 1-3 bullet points to CHANGELOG.md (create if missing)
- [ ] Reference ticket number
- [ ] Describe user-visible changes

**Format:**

```markdown
## [Unreleased]

### Added

- T-110: User authentication with email/password login

### Changed

- T-200: Improved composer UI validation

### Fixed

- T-250: Response history now persists across refresh
```

---

### Step 9: Open PR / Merge

- [ ] Commit with message: `T-###: concise change summary`
- [ ] Push branch to remote
- [ ] Open PR (if using PR workflow)
- [ ] Merge to main after CI passes

---

# Backlog Overview (Phases)

## Phase 1: Non‑AI analytics (charts + metrics)

Deliver trustworthy analytics without AI: year/term filters, section/class overview, student drilldown, evidence links.

## Phase 2: Topic system + per-question grading (foundation for deep analytics)

Introduce topic taxonomy (admin baseline + teacher extensions) + question topic tagging + per-question marks entry and rollups.

## Phase 3: AI insights (grounded in computed metrics)

Generate “insights” and “practice recommendations” from structured summaries with evidence and confidence.

## Phase 4: Parent AI practice tests (separate from official gradebook)

Parents generate practice tests per subject/topic; attempts are stored; results can be shared to teacher optionally.

---

# Tickets

## Phase 1 — Non‑AI analytics (teacher + parent)

# T-101: Analytics data contract + filters (Year/Term/All)

## Goal

Define a single, consistent analytics time-filtering model (Academic Year + Term + All terms) across analytics pages and APIs.

## Non-Goals

- Building charts/UI beyond minimal selectors
- AI insights generation

## Dependencies

- None

## Work Items

1. [ ] Define “analytics window” types (yearId, termId | null, allTerms default)
2. [ ] Add shared parsing/validation helpers for analytics filters (zod)
3. [ ] Ensure teacher scope and parent scope rules are documented for analytics endpoints

## Acceptance Criteria

- [ ] There is a clear filter contract: `academicYearId` required, `termId` optional, `termId = null` means “All terms”
- [ ] Filter logic is reusable across teacher/student/parent analytics
- [ ] Invalid/missing inputs return helpful errors (no silent defaults except “current year”)

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
```

---

# T-110: Teacher analytics — section/class overview (non‑AI)

## Goal

Add teacher analytics pages that show section/class performance over time and by assessment type for the selected year/term.

## Non-Goals

- Topic-level analytics
- AI narratives or recommendations
- Admin-wide analytics

## Dependencies

- T-101: Analytics data contract + filters

## Work Items

1. [ ] Create `/teacher/analytics` route with year/term selectors (default current year, all terms)
2. [ ] Build server data loader that only includes teacher’s allowed sections (class teacher OR subject teacher)
3. [ ] Compute metrics per section and per subject:
   - average %, median %, distribution buckets
   - trend series (weekly or monthly)
   - breakdown by assessment type
4. [ ] Add drilldown links to section → student list → student analytics (stub ok)

## Acceptance Criteria

- [ ] Teacher sees only their sections
- [ ] Metrics match stored assessment results
- [ ] Filters (year/term) change results correctly

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
npm run test:perf
```

---

# T-120: Student analytics — student self view (non‑AI)

## Goal

Add student-facing analytics based on their own results (subject trends + assessment type breakdown) for selected year/term.

## Non-Goals

- Topic-level analytics
- Parent view (separate ticket)

## Dependencies

- T-101: Analytics data contract + filters

## Work Items

1. [ ] Create `/student/analytics`
2. [ ] Compute per-subject trends and assessment type breakdown for the student
3. [ ] Add “evidence” linking (assessment list used in calculations)

## Acceptance Criteria

- [ ] Student can only see their own data
- [ ] Filters work (year/term/all)

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
```

---

# T-130: Parent analytics — per-child analytics (non‑AI)

## Goal

Add parent-facing analytics for each child: subject trends + assessment type breakdown for selected year/term.

## Non-Goals

- Topic-level analytics
- AI insights or practice tests (later phases)

## Dependencies

- T-101: Analytics data contract + filters

## Work Items

1. [ ] Create `/parent/analytics` with child selector + year/term filters
2. [ ] Ensure parent can only query linked children
3. [ ] Add evidence drilldown (assessments included)

## Acceptance Criteria

- [ ] Parent sees only their children’s analytics
- [ ] Switching child updates immediately (respect cache invalidations)

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
npm run test:perf
```

---

## Phase 2 — Topics + per-question grading (deep analytics foundation)

# T-201: Topic taxonomy (admin baseline + teacher extensions)

## Goal

Introduce a first-class topic taxonomy for each Class+Subject, with admin-managed topics and teacher-added topics.

## Non-Goals

- Automatic topic extraction from PDFs (AI or OCR)
- Topic analytics dashboards (later tickets)

## Dependencies

- T-101: Analytics data contract + filters (for consistent term/year associations later)

## Work Items

1. [ ] Add Prisma models for topics (e.g., `SubjectTopic`) with:
   - `subjectId`, `name`, optional `parentTopicId`
   - `source: ADMIN|TEACHER`, `createdByTeacherId?`, `status: ACTIVE|ARCHIVED`
2. [ ] Add admin UI to manage baseline topics per subject (CRUD + archive)
3. [ ] Add teacher UI to add topics (CRUD limited to teacher-created topics)
4. [ ] Add topic search + dedupe rules (case/whitespace normalization) per subject

## Acceptance Criteria

- [ ] Topics exist per subject and can be created by admin or teacher
- [ ] Teachers can use topics even if admin hasn’t created any
- [ ] Archived topics can’t be used for new questions (but remain for historical data)

## Verification Commands

```bash
npx prisma validate
npx tsc -p tsconfig.json --noEmit
```

---

# T-210: Question topic tagging for assessments

## Goal

Allow tagging each assessment question with a single topic (or “Uncategorized”) to enable topic-level scoring.

## Non-Goals

- Multi-topic questions (one-to-many) in v1
- AI auto-tagging

## Dependencies

- T-201: Topic taxonomy

## Work Items

1. [ ] Add `Question.topicId?` FK to `SubjectTopic` (nullable allowed)
2. [ ] Update assessment builder UI to set topic per question
3. [ ] Ensure topic list is filtered to the question’s subject

## Acceptance Criteria

- [ ] Teachers can tag questions by topic when building assessments
- [ ] Tagging is optional; untagged questions don’t break analytics

## Verification Commands

```bash
npx prisma validate
npx tsc -p tsconfig.json --noEmit
```

---

# T-220: Per-question marks entry for “printed” assessments

## Goal

Enable teachers to enter per-student marks per question for a given assessment, with MCQ auto-graded as all-or-nothing.

## Non-Goals

- Fast scanning OCR grading
- Partial credit for MCQ

## Dependencies

- T-210: Question topic tagging

## Work Items

1. [ ] Add a new Prisma model for per-question marks (e.g., `AssessmentQuestionResult`)
2. [ ] Build teacher grading UI:
   - list students for the assessment’s section
   - grid entry of marks per question
   - validation: `0..question.marks`, MCQ locked to `0|question.marks`
3. [ ] Compute and upsert `AssessmentResult` from per-question results (single source of truth)
4. [ ] Cache invalidation: revalidate teacher + student + parent tags impacted by grading

## Acceptance Criteria

- [ ] Teacher can enter per-question marks and save
- [ ] `AssessmentResult.marksObtained` equals sum of question marks per student
- [ ] MCQ entries cannot be partial (UI and API enforce)

## Verification Commands

```bash
npx prisma validate
npx tsc -p tsconfig.json --noEmit
npm run test:perf
```

---

# T-230: Topic scores rollup (populate `AssessmentResult.topicScores`)

## Goal

Compute topic-level scores for each student in an assessment from question marks and store them in `AssessmentResult.topicScores`.

## Non-Goals

- AI insights or recommendations

## Dependencies

- T-220: Per-question marks entry

## Work Items

1. [ ] Define `topicScores` JSON schema (versioned) for stored rollups
2. [ ] Implement rollup: per topic → obtained, total, percentage, questionCount
3. [ ] Backfill for existing assessments (best-effort; skip if no per-question data)
4. [ ] Expose topic scores in teacher/student/parent analytics APIs

## Acceptance Criteria

- [ ] Topic scores match question topic tags + marks
- [ ] Untagged questions are excluded (or grouped under “Uncategorized” by explicit rule)

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
```

---

## Phase 3 — AI insights (grounded in computed metrics)

# T-301: AI provider adapter + safety rails

## Goal

Introduce a pluggable AI provider interface (OpenAI/Anthropic/etc.) with strict safety and privacy constraints.

## Non-Goals

- Shipping any parent/teacher UI
- Fine-tuning or embeddings

## Dependencies

- External: AI provider account + API key (stored via env)

## Work Items

1. [ ] Define `AIClient` interface (generate insights, generate questions)
2. [ ] Add environment config + server-only guardrails
3. [ ] Add rate limiting per user + per school (basic, server-side)
4. [ ] Add prompt safety rules:
   - no other-student data
   - no medical/diagnostic claims
   - always cite evidence IDs (assessment IDs)

## Acceptance Criteria

- [ ] No AI call can be made client-side
- [ ] Prompts are grounded in structured metrics only (no raw DB dumps)
- [ ] Clear audit logging for AI calls (who/when/what scope)

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
```

---

# T-310: Teacher AI insights (student + section)

## Goal

Allow teachers to generate AI insights for a student or section, grounded in computed metrics and topic scores.

## Non-Goals

- Automatic emailing/messaging to parents
- AI auto-grading

## Dependencies

- T-230: Topic scores rollup
- T-301: AI provider adapter + safety rails

## Work Items

1. [ ] Create `AIInsight` model/table (scope: studentId|sectionId, subjectId optional, year/term filter)
2. [ ] Implement “Generate insight” action that:
   - builds a structured summary (stats + evidence IDs)
   - calls AI provider
   - stores result + confidence + evidence links
3. [ ] Teacher UI to view previous insights (no regen required)

## Acceptance Criteria

- [ ] Insights show evidence (assessment IDs) and confidence
- [ ] Teachers can regenerate (creates a new version)

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
```

---

# T-320: Parent AI insights (child only)

## Goal

Show AI insights to parents for their children only (subject strengths/weaknesses + topics + suggested practice).

## Non-Goals

- Parent generating insights for other children
- Teacher approval workflow (not required)

## Dependencies

- T-310: Teacher AI insights (or shared insight generator)

## Work Items

1. [ ] Parent UI to view AI insights per child/year/term
2. [ ] Enforce strict access control: parent must be linked to student
3. [ ] Add “evidence” links for transparency (assessment list)

## Acceptance Criteria

- [ ] Parents can only see their child’s insights
- [ ] Insights always list evidence and avoid sensitive claims

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
```

---

## Phase 4 — Parent AI practice tests (generation + attempts + share)

# T-401: Practice test domain models (separate from official assessments)

## Goal

Create dedicated DB models for parent-generated practice tests and attempts without affecting official gradebook.

## Non-Goals

- Reusing `Assessment` for practice tests
- Teacher assignment or timetable integration

## Dependencies

- T-201: Topic taxonomy (to target topics)

## Work Items

1. [ ] Add Prisma models:
   - `PracticeTest` (studentId, subjectId, topicIds, difficulty, createdByParentId, visibility)
   - `PracticeQuestion` (type MCQ/SHORT, topicId, marks, options, correct answer where applicable)
   - `PracticeAttempt` + `PracticeAnswer`
2. [ ] Add access rules: parent can only create for linked children
3. [ ] Add admin-safe deletion rules (cleanup old tests)

## Acceptance Criteria

- [ ] Practice tests are isolated from official assessments and results
- [ ] Parent/child scoping is enforced server-side

## Verification Commands

```bash
npx prisma validate
npx tsc -p tsconfig.json --noEmit
```

---

# T-410: Parent practice test generator (AI) — MCQ + short answer

## Goal

Let parents generate a practice test for a child by selecting subject + topic(s) + difficulty, including MCQ and short answer.

## Non-Goals

- Perfect pedagogical sequencing (adaptive comes later)
- Partial credit for MCQ

## Dependencies

- T-301: AI provider adapter + safety rails
- T-401: Practice test domain models

## Work Items

1. [ ] Parent UI flow: choose child → subject → topics → difficulty → counts → generate
2. [ ] Server action/API to generate questions:
   - MCQ includes correct option
   - short answer includes rubric/expected points (for feedback)
3. [ ] Store generated test and questions

## Acceptance Criteria

- [ ] Generated test includes both MCQ and short answer
- [ ] Content is constrained to selected subject/topic(s)
- [ ] MCQ answers are strictly correct/incorrect (no partial)

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
```

---

# T-420: Practice test attempt + grading

## Goal

Allow the child (or parent) to take the practice test, auto-grade MCQ, and store attempt results with topic breakdown.

## Non-Goals

- High-stakes grading
- Teacher gradebook integration

## Dependencies

- T-401: Practice test domain models

## Work Items

1. [ ] Attempt UI (timer optional)
2. [ ] Auto-grade MCQ (0 or full marks)
3. [ ] Short answer:
   - capture text answer
   - (v1) store ungraded or optionally AI-feedback if enabled
4. [ ] Compute per-topic practice performance summary

## Acceptance Criteria

- [ ] Attempts persist and show results immediately for MCQ
- [ ] Topic breakdown is visible to parent for the child

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
npm run test:perf
```

---

# T-430: “Share practice results with teacher” (opt-in)

## Goal

Allow parents to share a practice test attempt summary with the child’s teacher(s), only when parent chooses to share.

## Non-Goals

- Auto-sharing by default
- Sharing to unrelated teachers

## Dependencies

- T-420: Practice test attempt + grading
- Existing messaging/conversation system

## Work Items

1. [ ] Add “Share with teacher” CTA on results
2. [ ] Determine eligible teachers:
   - section class teacher
   - subject teacher for that subject (if available)
3. [ ] Send a message with summary + deep link to view (teacher access-controlled)
4. [ ] Audit log entry for share action

## Acceptance Criteria

- [ ] Sharing is explicit and reversible (optional “unshare”)
- [ ] Only correct teachers receive it
- [ ] Teacher view is read-only and scoped to that student

## Verification Commands

```bash
npx tsc -p tsconfig.json --noEmit
```
