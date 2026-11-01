/**
 * Synchronous single-flight lock for async actions (e.g. the checkout "Paga" button).
 *
 * React state (`loading`) only blocks a second tap after a re-render; two taps
 * handled before that commit would both start the task. This lock is checked and
 * set synchronously, so a second `run()` while busy is a no-op returning undefined.
 */
export interface SingleFlight {
  isBusy(): boolean;
  run<T>(task: () => Promise<T>): Promise<T | undefined>;
}

export function createSingleFlight(): SingleFlight {
  let busy = false;

  return {
    isBusy: () => busy,
    async run<T>(task: () => Promise<T>): Promise<T | undefined> {
      if (busy) return undefined;
      busy = true;
      try {
        return await task();
      } finally {
        busy = false;
      }
    },
  };
}
