import type { ErrorEvent } from '@sentry/react-native';

/** Deliberately discard free-form content, requests and breadcrumbs, rather than blacklist secrets. */
export function sanitizeCrashEvent(event: ErrorEvent): ErrorEvent {
  return {
    type: event.type,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    release: event.release,
    dist: event.dist,
    environment: event.environment,
    sdk: event.sdk,
    debug_meta: event.debug_meta,
    exception: event.exception
      ? {
          values: event.exception.values?.map((exception) => ({
            type: /^(TypeError|ReferenceError|SyntaxError|RangeError|Error)$/.test(
              exception.type || '',
            )
              ? exception.type
              : 'Error',
            value: 'Application error (message removed for privacy)',
            mechanism: exception.mechanism
              ? {
                  type: exception.mechanism.type,
                  handled: exception.mechanism.handled,
                }
              : undefined,
            stacktrace: exception.stacktrace
              ? {
                  frames: exception.stacktrace.frames?.map((frame) => ({
                    filename: frame.filename
                      ?.split(/[?#]/)[0]
                      ?.replace(/\\/g, '/')
                      .split('/')
                      .slice(-2)
                      .join('/'),
                    function: frame.function,
                    lineno: frame.lineno,
                    colno: frame.colno,
                    in_app: frame.in_app,
                    platform: frame.platform,
                  })),
                }
              : undefined,
          })),
        }
      : undefined,
  };
}
