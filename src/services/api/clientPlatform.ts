/**
 * Identifies native app requests. The backend accepts only phone OTP sessions
 * with this header and rejects password sign-in. Metro loads clientPlatform.web.ts
 * for web builds, which must not send it (CORS does not allow the header).
 */
export const CLIENT_PLATFORM_HEADERS: Record<string, string> = { 'X-Client-Platform': 'mobile' };
