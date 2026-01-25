/**
 * Sanitization utilities for preventing XSS and other injection attacks
 */

// HTML entities map for encoding
const HTML_ENTITIES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 * Use this when displaying user-generated content as text
 */
export function escapeHtml(str: string): string {
    return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Remove HTML tags from a string
 * More aggressive than escaping - strips all HTML
 */
export function stripHtml(str: string): string {
    return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize user input for safe display
 * - Trims whitespace
 * - Removes null bytes
 * - Escapes HTML entities
 */
export function sanitizeInput(str: string): string {
    return escapeHtml(
        str
            .trim()
            // Remove null bytes
            .replace(/\0/g, '')
            // Normalize Unicode
            .normalize('NFC')
    );
}

/**
 * Sanitize message content for chat
 * - Allows newlines (for multiline messages)
 * - Trims excessive whitespace
 * - Escapes HTML
 */
export function sanitizeMessage(content: string): string {
    return content
        .trim()
        // Remove null bytes
        .replace(/\0/g, '')
        // Normalize multiple newlines to max 2
        .replace(/\n{3,}/g, '\n\n')
        // Remove leading/trailing whitespace from each line
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        .trim();
}

/**
 * Sanitize search query
 * - Removes special characters that could be used for injection
 * - Trims whitespace
 */
export function sanitizeSearchQuery(query: string): string {
    return query
        .trim()
        // Remove characters that could be used for SQL injection
        .replace(/['"`;\\]/g, '')
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        .substring(0, 100);
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string {
    return email.toLowerCase().trim();
}

/**
 * Check if a string contains potentially dangerous content
 */
export function containsDangerousContent(str: string): boolean {
    const dangerousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi, // onclick, onerror, etc.
        /data:/gi,
        /vbscript:/gi,
    ];

    return dangerousPatterns.some((pattern) => pattern.test(str));
}

/**
 * Truncate string to max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}
