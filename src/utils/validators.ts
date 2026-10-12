export function sanitizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
export function sanitizeSingleLine(value: string): string {
  return value.replace(/[\r\n\t]/g, ' ').trim();
}
