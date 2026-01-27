# Analytics Filter Contract (Academic Year / Term)

This doc defines the canonical time filtering contract used by analytics pages and analytics APIs.

## Query Parameters

### `academicYearId` (string)
- **Required** for analytics requests.
- If omitted, the server **may** fallback to the school’s `isCurrent` academic year.
- If no current year exists and `academicYearId` is omitted, requests should return **400** with a helpful error.

### `termId` (string, optional)
- If omitted, analytics defaults to **All terms** (the full academic year range).
- If provided, it must belong to the given `academicYearId`.
- **Deprecated alias:** `termId=all` is accepted for backwards compatibility and treated the same as “omitted”.

## Semantics

- `termId = null` (omitted) means: **use the full Academic Year date range**.
- `termId = <id>` means: **use the Term date range**.

## Example URLs

All terms in a year:
```text
/api/analytics/performance/sections?academicYearId=YEAR_ID
```

Term 1 only:
```text
/api/analytics/performance/sections?academicYearId=YEAR_ID&termId=TERM_ID
```

## Access Control Rules (Analytics Scope)

### Admin Analytics
- Role: `ADMIN` / `SUPER_ADMIN`
- Scope: can query analytics for **any** section/class/student in their `schoolId`.

### Teacher Analytics
- Role: `TEACHER`
- Scope: can query analytics only for:
  - sections where they are class teacher (`SectionTeacher`), OR
  - sections where they are assigned as a subject teacher (`SectionSubjectTeacher`)
- When requesting section detail analytics:
  - If class teacher of the section: **full section analytics**
  - Otherwise: analytics should be limited to subjects they teach in that section.

### Parent Analytics
- Role: `PARENT`
- Scope: can query analytics only for **linked children** (`ParentStudent`).

## Implementation Notes

- Server resolution should return a concrete `{ from, to }` date range derived from academic year / term.
- Error messaging should prefer clarity (e.g. “Invalid termId for this academic year”).

