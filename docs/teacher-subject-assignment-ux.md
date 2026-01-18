# Plan: Streamline Teacher-Subject Assignment UX

## Current Problems

### Confusing Two-Level System
1. **Class Level (TeacherSubject)**: Which teachers *can* teach a subject
2. **Section Level (SectionSubjectTeacher)**: Which teacher *actually* teaches a subject in a specific section

Users must:
- First assign teacher to subject at class level (Subjects page)
- Then assign that teacher to sections (Classes page → Manage Teachers)

### Scattered Entry Points
- Subjects page → Manage Teachers (class-level only)
- Teachers page → Add Subject Expertise (class-level only)
- Classes page → Section → Manage Teachers (section-level, limited to pre-assigned teachers)

### Missing Features
- No way to do everything from one place
- No visual overview of who teaches what where
- Can't assign a teacher to a subject AND sections in one flow

---

## Proposed Solution

### Option A: Enhanced Subjects Page (Recommended)
Add a comprehensive "Manage Teachers" dialog that handles both levels in one place.

**Flow:**
1. Go to Subjects page → Select class → Click subject → "Manage Teachers"
2. Dialog shows:
   - **Teachers who can teach this subject** (class-level)
   - For each teacher: checkboxes for **which sections they teach** (section-level)
3. Add new teacher → automatically shows section assignment options

**Wireframe:**
```
┌─────────────────────────────────────────────────────────┐
│ Manage Teachers - Mathematics (Grade 6)                 │
├─────────────────────────────────────────────────────────┤
│ Add Teacher: [Select teacher ▼] [+ Add]                 │
├─────────────────────────────────────────────────────────┤
│ Assigned Teachers:                                      │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 John Smith                              [Remove] │ │
│ │    Teaches in sections:                             │ │
│ │    ☑ Section A  ☑ Section B  ☐ Section C           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤 Jane Doe                                [Remove] │ │
│ │    Teaches in sections:                             │ │
│ │    ☐ Section A  ☑ Section B  ☑ Section C           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- One place to manage everything for a subject
- Clear visual of who teaches where
- Checkbox UX is intuitive

---

### Option B: Teacher Assignment Matrix Page
Create a new dedicated page showing a matrix view.

**Route:** `/admin/assignments`

**View:**
```
┌──────────────────────────────────────────────────────────────┐
│ Teacher Assignments                                          │
├──────────────────────────────────────────────────────────────┤
│ Class: [Grade 6 ▼]                                           │
├──────────────────────────────────────────────────────────────┤
│                │ Section A │ Section B │ Section C │         │
│ Subject        │           │           │           │         │
├────────────────┼───────────┼───────────┼───────────┤         │
│ Mathematics    │ J. Smith  │ J. Smith  │ J. Doe    │ [Edit]  │
│ English        │ M. Brown  │ M. Brown  │ M. Brown  │ [Edit]  │
│ Science        │ —         │ K. Lee    │ K. Lee    │ [Edit]  │
│ History        │ —         │ —         │ —         │ [Edit]  │
└──────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Bird's eye view of all assignments
- Easy to spot gaps (unassigned subjects/sections)
- Quick editing from one page

---

### Option C: Wizard-Style Assignment Flow
When adding a teacher to a subject, guide through sections.

**Flow:**
1. Click "Add Teacher to Subject"
2. Step 1: Select Teacher
3. Step 2: Select which sections they'll teach
4. Done - both levels assigned in one action

---

## Recommendation

**Implement Option A first** (Enhanced Subjects Page) because:
- Minimal new UI - enhances existing page
- Solves the main pain point immediately
- Keeps existing navigation patterns

**Then add Option B** (Matrix Page) as a power-user feature for:
- School admins managing many classes
- Quick overview and gap identification

---

## Implementation Steps for Option A

### Phase 1: API Enhancement
1. Create `GET /api/classes/[id]/subjects/[subjectId]/assignments`
   - Returns teachers assigned to subject WITH their section assignments
   - Includes all sections for the class (for checkbox rendering)

2. Create `PUT /api/classes/[id]/subjects/[subjectId]/assignments`
   - Accepts: `{ teacherId, sectionIds: string[] }`
   - Updates both TeacherSubject and SectionSubjectTeacher in one call

### Phase 2: UI Enhancement
1. Update Subjects page "Manage Teachers" dialog
   - Fetch assignments data (teachers + their sections)
   - Render teacher cards with section checkboxes
   - Handle checkbox changes with optimistic updates

2. Add "Add Teacher" flow
   - Select teacher dropdown
   - On add: create TeacherSubject, show section checkboxes
   - User checks sections, saves SectionSubjectTeacher records

### Phase 3: Polish
1. Add loading states for individual teacher cards
2. Add confirmation for removing teacher (warns about section removals)
3. Add empty state guidance

---

## Files to Modify/Create

### New Files
- `src/app/api/classes/[id]/subjects/[subjectId]/assignments/route.ts`

### Modified Files
- `src/app/(dashboard)/admin/subjects/page.tsx` - Enhanced dialog

---

## Decisions Made

1. **Option B (Matrix Page) first** - Create dedicated assignments page with grid view
2. **Warn before removing** - Show confirmation dialog when removing teacher affects sections
3. **Manual save button** - Collect all changes and save when user clicks "Save"

---

## Implementation Steps for Option B (Selected)

### Phase 1: API
1. Create `GET /api/assignments` - Returns matrix data for a class
2. Create `PUT /api/assignments` - Bulk update assignments

### Phase 2: UI
1. Create `/admin/assignments/page.tsx` - Matrix view page
2. Add class selector dropdown
3. Build editable grid with teacher dropdowns per cell
4. Add Save/Cancel buttons with dirty state tracking
5. Add confirmation dialog for removals

### Phase 3: Navigation
1. Add "Assignments" link to sidebar
2. Add quick link from Classes and Subjects pages
