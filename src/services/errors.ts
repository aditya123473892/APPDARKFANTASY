export type ServiceErrorCode =
  'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'NETWORK' | 'VALIDATION' | 'UNKNOWN';

/** Transport-agnostic error thrown by feature services. Real services map HTTP errors into these codes. */
export class ServiceError extends Error {
  readonly code: ServiceErrorCode;
  constructor(code: ServiceErrorCode, message = 'Something went wrong') {
    super(message);
    this.code = code;
    this.name = 'ServiceError';
  }
}

export function isServiceError(error: unknown, code?: ServiceErrorCode): error is ServiceError {
  return error instanceof ServiceError && (code === undefined || error.code === code);
}

/** User-facing copy for an unknown failure. Never surfaces raw server messages or tokens. */
export function describeError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof ServiceError)) return fallback;
  switch (error.code) {
    case 'NETWORK':
      return "You're offline or the connection dropped. Please try again.";
    case 'NOT_FOUND':
      return 'This is no longer available.';
    case 'FORBIDDEN':
      return "You don't have access to this.";
    case 'VALIDATION':
    case 'CONFLICT':
      return error.message;
    default:
      return fallback;
  }
}
