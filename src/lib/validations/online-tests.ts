import { z } from "zod";

// ==================== ENUMS ====================

export const QuestionType = {
  MCQ: "MCQ",
  SHORT_ANSWER: "SHORT_ANSWER",
} as const;

export const OnlineTestStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  CLOSED: "CLOSED",
} as const;

export const TestAttemptStatus = {
  IN_PROGRESS: "IN_PROGRESS",
  SUBMITTED: "SUBMITTED",
  GRADED: "GRADED",
} as const;

// ==================== ONLINE TEST SCHEMAS ====================

export const createOnlineTestSchema = z.object({
  assessmentId: z.string().min(1, "Assessment is required"),
  timeLimitMins: z.number().min(1).max(480).optional().nullable(),
  instructions: z.string().max(5000).optional().nullable(),
  shuffleQuestions: z.boolean().default(false),
  showResults: z.boolean().default(true),
  passingScore: z.number().min(0).max(100).optional().nullable(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
});

export const updateOnlineTestSchema = z.object({
  timeLimitMins: z.number().min(1).max(480).optional().nullable(),
  instructions: z.string().max(5000).optional().nullable(),
  shuffleQuestions: z.boolean().optional(),
  showResults: z.boolean().optional(),
  passingScore: z.number().min(0).max(100).optional().nullable(),
  startTime: z.string().datetime().optional().nullable(),
  endTime: z.string().datetime().optional().nullable(),
});

// ==================== QUESTION SCHEMAS ====================

export const questionOptionSchema = z.object({
  optionText: z.string().min(1, "Option text is required").max(1000),
  isCorrect: z.boolean(),
  orderIndex: z.number().int().min(0).optional(),
});

export const createMCQQuestionSchema = z.object({
  type: z.literal("MCQ"),
  questionText: z.string().min(1, "Question text is required").max(5000),
  marks: z.number().positive("Marks must be positive"),
  orderIndex: z.number().int().min(0).optional(),
  explanation: z.string().max(2000).optional().nullable(),
  options: z.array(questionOptionSchema)
    .min(2, "At least 2 options required")
    .max(6, "Maximum 6 options allowed"),
}).refine(
  (data) => data.options.filter(o => o.isCorrect).length === 1,
  { message: "Exactly one option must be marked as correct", path: ["options"] }
);

export const createShortAnswerQuestionSchema = z.object({
  type: z.literal("SHORT_ANSWER"),
  questionText: z.string().min(1, "Question text is required").max(5000),
  marks: z.number().positive("Marks must be positive"),
  orderIndex: z.number().int().min(0).optional(),
  explanation: z.string().max(2000).optional().nullable(),
});

export const createQuestionSchema = z.discriminatedUnion("type", [
  createMCQQuestionSchema,
  createShortAnswerQuestionSchema,
]);

export const updateQuestionSchema = z.object({
  questionText: z.string().min(1, "Question text is required").max(5000).optional(),
  marks: z.number().positive("Marks must be positive").optional(),
  orderIndex: z.number().int().min(0).optional(),
  explanation: z.string().max(2000).optional().nullable(),
  options: z.array(questionOptionSchema)
    .min(2, "At least 2 options required")
    .max(6, "Maximum 6 options allowed")
    .optional(),
});

export const reorderQuestionsSchema = z.object({
  questions: z.array(z.object({
    id: z.string().min(1),
    orderIndex: z.number().int().min(0),
  })),
});

// ==================== STUDENT ANSWER SCHEMAS ====================

export const saveAnswerSchema = z.object({
  questionId: z.string().min(1, "Question ID is required"),
  answerText: z.string().max(10000).optional().nullable(),
  selectedOptionId: z.string().optional().nullable(),
});

export const submitTestSchema = z.object({
  // Optional: can include final answers to save before submitting
  answers: z.array(saveAnswerSchema).optional(),
});

// ==================== GRADING SCHEMAS ====================

export const gradeAnswerSchema = z.object({
  answerId: z.string().min(1, "Answer ID is required"),
  marksAwarded: z.number().min(0, "Marks cannot be negative"),
  feedback: z.string().max(2000).optional().nullable(),
});

export const gradeMultipleAnswersSchema = z.object({
  grades: z.array(gradeAnswerSchema),
});

// ==================== FILE UPLOAD SCHEMAS ====================

export const FileType = {
  PDF: "PDF",
  IMAGE: "IMAGE",
  DOCUMENT: "DOCUMENT",
} as const;

export const allowedMimeTypes = {
  "application/pdf": "PDF",
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/gif": "IMAGE",
  "image/webp": "IMAGE",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
} as const;

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ==================== TYPES ====================

export type CreateOnlineTestInput = z.infer<typeof createOnlineTestSchema>;
export type UpdateOnlineTestInput = z.infer<typeof updateOnlineTestSchema>;
export type CreateMCQQuestionInput = z.infer<typeof createMCQQuestionSchema>;
export type CreateShortAnswerQuestionInput = z.infer<typeof createShortAnswerQuestionSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ReorderQuestionsInput = z.infer<typeof reorderQuestionsSchema>;
export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;
export type SubmitTestInput = z.infer<typeof submitTestSchema>;
export type GradeAnswerInput = z.infer<typeof gradeAnswerSchema>;
export type GradeMultipleAnswersInput = z.infer<typeof gradeMultipleAnswersSchema>;
