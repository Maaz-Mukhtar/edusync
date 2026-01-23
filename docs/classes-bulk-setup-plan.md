# Classes Bulk Setup - Implementation Plan

## Overview

Enhance the "Add Class" dialog to support bulk creation of classes with configurable sections, replacing the need to manually create each class and section individually.

---

## Current State (Problem)

- Admin creates Grade 1 → then adds Section A, B, C manually
- Repeat 12 times for all grades
- **~36+ clicks** to set up a school structure
- Time-consuming and error-prone

## Proposed State (Solution)

- Enhanced "Add Class" dialog with tabs: "Single Class" | "Bulk Setup"
- Configure once → generates all classes and sections
- **~5 clicks** total
- Preview before creation

---

## Design Specification

### UI: Enhanced Dialog with Tabs

```
┌─────────────────────────────────────────────────────────┐
│  Add Classes                                        [X] │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐                      │
│  │ Single Class │ │ Bulk Setup   │  ← Tabs              │
│  └──────────────┘ └──────────────┘                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  BULK SETUP TAB:                                        │
│                                                         │
│  Class Range                                            │
│  ┌─────────────┐     ┌─────────────┐                    │
│  │ Grade 1   ▼ │ to  │ Grade 12  ▼ │                    │
│  └─────────────┘     └─────────────┘                    │
│                                                         │
│  Sections per Class                                     │
│  ┌─────────────┐                                        │
│  │ 3         ▼ │                                        │
│  └─────────────┘                                        │
│                                                         │
│  Section Naming                                         │
│  ┌─────────────────────────────┐                        │
│  │ Letters (A, B, C...)      ▼ │                        │
│  └─────────────────────────────┘                        │
│                                                         │
│  [If Custom selected:]                                  │
│  ┌─────────────────────────────┐                        │
│  │ Morning, Afternoon, Evening │  ← Comma separated     │
│  └─────────────────────────────┘                        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  PREVIEW                                                │
│  ┌─────────────────────────────────────────────────┐    │
│  │ Class      │ Sections                           │    │
│  ├────────────┼────────────────────────────────────┤    │
│  │ Grade 1    │ A, B, C                            │    │
│  │ Grade 2    │ A, B, C                            │    │
│  │ ...        │ ...                                │    │
│  │ Grade 12   │ A, B, C                            │    │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  Summary: 12 classes, 36 sections                       │
│                                                         │
│              [Cancel]  [Create All]                     │
└─────────────────────────────────────────────────────────┘
```

---

## Configuration Options

### 1. Class Range Selection

**Type:** Custom range with From/To dropdowns

```
From: [Grade 1 ▼]  To: [Grade 12 ▼]
```

- Dropdown options: Grade 1 through Grade 12
- Validates that "From" is less than or equal to "To"
- Class names generated as: "Grade 1", "Grade 2", etc.

### 2. Sections Per Class

**Type:** Same for all classes (single number input)

```
Sections per class: [3 ▼]
```

- Dropdown or number input: 1-8 sections
- All classes get the same number of sections
- Simpler approach that covers 90% of use cases

### 3. Section Naming Convention

**Type:** Dropdown with presets + custom option

| Preset | Values Generated |
|--------|------------------|
| Letters | A, B, C, D, E, F, G, H |
| Colors | Blue, Green, Red, Yellow, Orange, Purple, Pink, White |
| Numbers | 1, 2, 3, 4, 5, 6, 7, 8 |
| Roman | I, II, III, IV, V, VI, VII, VIII |
| Custom | User enters comma-separated names |

**Custom Input:**
- Text field appears when "Custom" is selected
- User enters names separated by commas
- Example: "Morning, Afternoon, Evening"
- Validation: Must have at least as many names as sections requested

---

## Preview Table

Before creating, show a preview of what will be created:

| Class | Sections |
|-------|----------|
| Grade 1 | A, B, C |
| Grade 2 | A, B, C |
| Grade 3 | A, B, C |
| ... | ... |
| Grade 12 | A, B, C |

**Summary:** 12 classes, 36 sections

---

## Technical Implementation

### Files to Modify

1. **`src/app/(dashboard)/admin/classes/page.tsx`**
   - Update the Add Class dialog to include tabs
   - Add Bulk Setup tab content
   - Add preview table component

2. **`src/app/api/classes/bulk/route.ts`** (NEW)
   - New API endpoint for bulk class creation
   - Accepts: fromGrade, toGrade, sectionsPerClass, namingConvention, customNames
   - Creates classes and sections in a transaction
   - Returns created classes with sections

### API Endpoint

**POST `/api/classes/bulk`**

Request:
```json
{
  "fromGrade": 1,
  "toGrade": 12,
  "sectionsPerClass": 3,
  "namingConvention": "letters",
  "customNames": null
}
```

Response:
```json
{
  "success": true,
  "created": {
    "classes": 12,
    "sections": 36
  },
  "data": [
    {
      "id": "...",
      "name": "Grade 1",
      "sections": [
        { "id": "...", "name": "A" },
        { "id": "...", "name": "B" },
        { "id": "...", "name": "C" }
      ]
    },
    // ...
  ]
}
```

### Database Operations

```typescript
// Pseudocode for bulk creation
async function createBulkClasses(data) {
  const { fromGrade, toGrade, sectionsPerClass, namingConvention, customNames } = data;

  const sectionNames = getSectionNames(namingConvention, sectionsPerClass, customNames);

  return prisma.$transaction(async (tx) => {
    const createdClasses = [];

    for (let grade = fromGrade; grade <= toGrade; grade++) {
      // Check if class already exists
      const existing = await tx.class.findFirst({
        where: { schoolId, name: `Grade ${grade}` }
      });

      if (existing) {
        continue; // Skip existing classes
      }

      // Create class with sections
      const newClass = await tx.class.create({
        data: {
          schoolId,
          name: `Grade ${grade}`,
          displayOrder: grade,
          sections: {
            create: sectionNames.map(name => ({ name }))
          }
        },
        include: { sections: true }
      });

      createdClasses.push(newClass);
    }

    return createdClasses;
  });
}
```

### Section Name Generation

```typescript
const NAMING_PRESETS = {
  letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  colors: ['Blue', 'Green', 'Red', 'Yellow', 'Orange', 'Purple', 'Pink', 'White'],
  numbers: ['1', '2', '3', '4', '5', '6', '7', '8'],
  roman: ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'],
};

function getSectionNames(convention: string, count: number, customNames?: string[]): string[] {
  if (convention === 'custom' && customNames) {
    return customNames.slice(0, count);
  }
  return NAMING_PRESETS[convention].slice(0, count);
}
```

---

## Edge Cases & Validation

### Validation Rules

1. **Class range:** `fromGrade <= toGrade`
2. **Sections:** 1-8 sections allowed
3. **Custom names:** Must provide at least `sectionsPerClass` names
4. **Duplicates:** Skip classes that already exist (show warning)

### Error Handling

- If some classes exist: Create only new ones, show summary of skipped
- If all classes exist: Show message "All classes already exist"
- Database errors: Roll back entire transaction

### Warning Messages

```
⚠️ 3 classes already exist (Grade 1, Grade 2, Grade 3) and will be skipped.
   9 new classes will be created.
```

---

## UI Components Needed

1. **Tabs Component** - Switch between Single/Bulk modes
2. **Range Selector** - From/To grade dropdowns
3. **Number Selector** - Sections per class
4. **Naming Dropdown** - Presets + custom option
5. **Custom Input** - Comma-separated names field
6. **Preview Table** - Shows what will be created
7. **Summary Badge** - "12 classes, 36 sections"

---

## User Flow

1. Admin clicks "Add Class" button
2. Dialog opens with two tabs: "Single Class" | "Bulk Setup"
3. Admin clicks "Bulk Setup" tab
4. Admin selects:
   - Class range: Grade 1 to Grade 12
   - Sections per class: 3
   - Naming: Letters (A, B, C)
5. Preview table updates in real-time
6. Admin reviews preview and clicks "Create All"
7. Loading state while creating
8. Success toast: "Created 12 classes with 36 sections"
9. Dialog closes, table refreshes

---

## Future Enhancements (Out of Scope)

- Section capacity configuration
- Different sections per grade range
- Class name prefix customization (Grade vs Class)
- Import from template/other school

---

*Document Version: 1.0*
*Created: January 2025*
*Branch: Classes*
