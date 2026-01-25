import { z } from 'zod';

// =============================================
// Message Validation
// =============================================

export const messageSchema = z.object({
    content: z
        .string()
        .min(1, 'Message cannot be empty')
        .max(4000, 'Message must be less than 4000 characters')
        .transform((val) => val.trim())
        .refine((val) => val.length > 0, {
            message: 'Message cannot be only whitespace',
        }),
});

export type MessageInput = z.infer<typeof messageSchema>;

// =============================================
// Authentication Validation
// =============================================

export const loginSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email address')
        .transform((val) => val.toLowerCase().trim()),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
    name: z
        .string()
        .min(1, 'Name is required')
        .min(2, 'Name must be at least 2 characters')
        .max(50, 'Name must be less than 50 characters')
        .transform((val) => val.trim()),
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Invalid email address')
        .transform((val) => val.toLowerCase().trim()),
    password: z
        .string()
        .min(1, 'Password is required')
        .min(6, 'Password must be at least 6 characters')
        .max(100, 'Password must be less than 100 characters'),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// =============================================
// User Search Validation
// =============================================

export const searchQuerySchema = z.object({
    query: z
        .string()
        .max(100, 'Search query too long')
        .transform((val) => val.trim()),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

// =============================================
// Conversation Validation
// =============================================

export const conversationNameSchema = z.object({
    name: z
        .string()
        .max(100, 'Group name must be less than 100 characters')
        .transform((val) => val.trim())
        .optional(),
});

export type ConversationNameInput = z.infer<typeof conversationNameSchema>;

// =============================================
// Utility Functions
// =============================================

/**
 * Validate and parse input with a Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
export function validate<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    // Get first error message
    const errorMessage = result.error.issues[0]?.message || 'Validation failed';
    return { success: false, error: errorMessage };
}

/**
 * Get all validation errors from a Zod result
 */
export function getValidationErrors<T>(
    schema: z.ZodSchema<T>,
    data: unknown
): Record<string, string> {
    const result = schema.safeParse(data);

    if (result.success) {
        return {};
    }

    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        if (!errors[path]) {
            errors[path] = issue.message;
        }
    }

    return errors;
}
