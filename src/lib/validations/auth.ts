import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z
    .string()
    .regex(/^(\+92|0)?[0-9]{10}$/, "Invalid Pakistani phone number")
    .optional()
    .or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.email || data.phone, {
  message: "Email or phone number is required",
  path: ["email"],
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
