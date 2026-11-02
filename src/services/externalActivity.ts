/**
 * Tracks system screens the app opens itself: photo pickers, the camera, share and save
 * sheets, permission prompts. Android reports those as the app going to the background,
 * which used to lock App Lock and the vault (and delete the vault's temporary files) in the
 * middle of adding, sharing or downloading. Locks treat such a trip as staying in the app,
 * unless it lasts longer than EXTERNAL_GRACE_MS.
 */
export const EXTERNAL_GRACE_MS = 5 * 60_000;

let open = 0;

/** Runs `work` (which opens a system screen) without triggering the app's locks. */
export async function whileExternal<T>(work: () => Promise<T>): Promise<T> {
  open++;
  try {
    return await work();
  } finally {
    open--;
  }
}

/** True while a system screen opened by the app is showing. */
export const inExternalActivity = (): boolean => open > 0;
