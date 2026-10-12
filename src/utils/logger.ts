type LogValue = string | number | boolean | null | undefined | Record<string, unknown>;
export const logger = {
  debug(message: string, context?: LogValue): void {
    if (__DEV__) console.debug(`[app] ${message}`, context ?? '');
  },
  error(message: string): void {
    if (__DEV__) console.error(`[app] ${message}`);
  },
};
