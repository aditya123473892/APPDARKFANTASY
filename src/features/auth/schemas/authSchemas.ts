import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
});
export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(50),
  lastName: z.string().trim().min(1, 'Enter your last name').max(50),
  age: z
    .string()
    .regex(/^\d{1,3}$/, 'Enter your age')
    .refine((value) => Number(value) > 0 && Number(value) <= 120, 'Enter a valid age'),
  gender: z.string().trim().min(1, 'Enter your gender').max(50),
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
