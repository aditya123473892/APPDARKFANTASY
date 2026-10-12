import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Enter a valid email address').transform((value) => value.trim().toLowerCase()),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(50),
  email: z.email('Enter a valid email address').transform((value) => value.trim().toLowerCase()),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[A-Z]/, 'Add one uppercase letter')
    .regex(/[0-9]/, 'Add one number'),
});
export const forgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address').transform((value) => value.trim().toLowerCase()),
});
export const inviteCodeSchema = z.object({
  code: z.string().trim().min(6, 'Enter your invite code').max(16),
});
export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
