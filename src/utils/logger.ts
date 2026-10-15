// Fixed event names only: never accept exception objects, response bodies or credentials.
type Event = 'Preferences could not be read; using defaults' | 'Preferences could not be saved';
export const logger = {
  debug(message: Event): void {
    if (__DEV__) console.debug(`[app] ${message}`);
  },
};
