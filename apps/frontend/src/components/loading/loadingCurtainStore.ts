/**
 * Who needs the loading curtain. Each mounted `LoadingScreen` holds it; the single
 * `LoadingCurtainHost` (`main.tsx`) shows the mark while at least one hold is active.
 *
 * Module state rather than a React context: two loading screens mounted one after the other
 * (the session, then a layout) keep one curtain instead of closing and reopening it.
 */

const holds = new Set<symbol>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

/** Holds the curtain until the returned function is called (idempotent). */
export function holdLoadingCurtain(): () => void {
  const hold = Symbol("hold");
  holds.add(hold);
  emit();
  return () => {
    if (holds.delete(hold)) emit();
  };
}

export function isLoadingCurtainHeld(): boolean {
  return holds.size > 0;
}

export function subscribeLoadingCurtain(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const SEEN_KEY = "tekad-curtain-seen";
let firstPageOfSession: boolean | undefined;

/**
 * True on the browser session's first page load (the tab's `sessionStorage`). Computed once per
 * page so that React's double effects in development don't consume it.
 */
export function isFirstPageOfSession(): boolean {
  if (firstPageOfSession === undefined) {
    try {
      firstPageOfSession = sessionStorage.getItem(SEEN_KEY) === null;
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      firstPageOfSession = false;
    }
  }
  return firstPageOfSession;
}
