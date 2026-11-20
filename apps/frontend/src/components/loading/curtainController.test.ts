import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCurtainController,
  type CurtainElements,
} from "./curtainController";

const PARTS = [
  "root",
  "veil",
  "hero",
  "roof",
  "gem",
  "word",
  "tagline",
] as const;

/** Bare elements (the tests run without a DOM): a dataset, and `animate` only when given. */
function elements(
  animate?: (name: string) => Element["animate"],
): CurtainElements {
  return Object.fromEntries(
    PARTS.map((name) => [
      name,
      { dataset: {}, ...(animate && { animate: animate(name) }) },
    ]),
  ) as unknown as CurtainElements;
}

const shown = (els: CurtainElements) => els.root.dataset.shown === "true";
const spinning = (els: CurtainElements) =>
  (els.hero as HTMLElement).dataset.spin === "true";

/** `animate` whose animations finish when `settle()` is called. */
function fakeAnimations() {
  const pending: Array<() => void> = [];
  const calls: string[] = [];
  const els = elements(
    (name) =>
      (() => {
        calls.push(name);
        let resolve!: () => void;
        const finished = new Promise<void>((r) => (resolve = r));
        pending.push(resolve);
        return { finished, cancel: () => {} } as unknown as Animation;
      }) as Element["animate"],
  );
  return {
    els,
    calls,
    async settle() {
      pending.splice(0).forEach((resolve) => resolve());
      await vi.advanceTimersByTimeAsync(0);
    },
  };
}

describe("createCurtainController", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("never shows for a load shorter than the show delay", () => {
    const els = elements();
    const curtain = createCurtainController(els, {
      reducedMotion: true,
      splash: false,
    });
    curtain.setHeld(true);
    vi.advanceTimersByTime(100);
    curtain.setHeld(false);
    vi.advanceTimersByTime(1000);
    expect(shown(els)).toBe(false);
  });

  it("shows after the delay and hides once released", () => {
    const els = elements();
    const curtain = createCurtainController(els, {
      reducedMotion: true,
      splash: false,
    });
    curtain.setHeld(true);
    vi.advanceTimersByTime(150);
    expect(shown(els)).toBe(true);
    curtain.setHeld(false);
    vi.advanceTimersByTime(120);
    expect(shown(els)).toBe(false);
  });

  it("stays up when a new hold follows a release within the grace delay", () => {
    const els = elements();
    const curtain = createCurtainController(els, {
      reducedMotion: true,
      splash: false,
    });
    curtain.setHeld(true);
    vi.advanceTimersByTime(150);
    curtain.setHeld(false);
    vi.advanceTimersByTime(50);
    curtain.setHeld(true);
    vi.advanceTimersByTime(1000);
    expect(shown(els)).toBe(true);
  });

  it("opens at once on the session's first page", () => {
    const els = elements();
    const curtain = createCurtainController(els, {
      reducedMotion: true,
      splash: true,
    });
    curtain.setHeld(true);
    expect(shown(els)).toBe(true);
  });

  it("assembles the mark, spins the diamond while held, then dives through it", async () => {
    const { els, calls, settle } = fakeAnimations();
    const curtain = createCurtainController(els, {
      reducedMotion: false,
      splash: false,
    });
    curtain.setHeld(true);
    vi.advanceTimersByTime(150);
    expect(shown(els)).toBe(true);
    // The veil closes at once, never fades in over the page behind.
    expect(calls).toEqual(["roof", "gem", "word", "tagline"]);

    await settle(); // assembled, still loading: the diamond spins
    expect(spinning(els)).toBe(true);
    expect(calls).toHaveLength(4);

    curtain.setHeld(false);
    vi.advanceTimersByTime(120);
    expect(calls.slice(4)).toEqual(["word", "tagline", "hero", "veil"]);
    expect(shown(els)).toBe(true);

    await settle();
    expect(shown(els)).toBe(false);
    expect(spinning(els)).toBe(false);
  });

  it("finishes the entrance before leaving when released mid-flight", async () => {
    const { els, calls, settle } = fakeAnimations();
    const curtain = createCurtainController(els, {
      reducedMotion: false,
      splash: true,
    });
    curtain.setHeld(true);
    curtain.setHeld(false);
    vi.advanceTimersByTime(120);
    expect(calls).toHaveLength(4);
    await settle();
    expect(calls.slice(4)).toEqual(["word", "tagline", "hero", "veil"]);
    await settle();
    expect(shown(els)).toBe(false);
  });

  it("closes the phase at the safety net when an animation never finishes", async () => {
    const { els, calls } = fakeAnimations();
    const curtain = createCurtainController(els, {
      reducedMotion: false,
      splash: true,
    });
    curtain.setHeld(true);
    curtain.setHeld(false);
    await vi.advanceTimersByTimeAsync(1600);
    expect(calls.slice(4)).toEqual(["word", "tagline", "hero", "veil"]);
    await vi.advanceTimersByTimeAsync(1600);
    expect(shown(els)).toBe(false);
  });
});
