/** Keep caller cancellation and session teardown; release listeners on completion. */
export function requestSignal(session: AbortSignal, caller?: AbortSignal) {
  if (!caller || caller === session) return { signal: session, dispose: () => undefined };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  session.addEventListener('abort', cancel, { once: true });
  caller.addEventListener('abort', cancel, { once: true });
  if (session.aborted || caller.aborted) cancel();
  return { signal: controller.signal, dispose: () => {
    session.removeEventListener('abort', cancel); caller.removeEventListener('abort', cancel);
  } };
}
