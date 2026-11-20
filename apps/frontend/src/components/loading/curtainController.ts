/**
 * The Tekad mark's pass on the loading curtain: the roof (the receipt) drops into place like
 * a slip printed by a till, the teal diamond lands under it with a turn, and the
 * wordmark is revealed beside it; the diamond keeps turning while loading lasts, then we dive
 * through the diamond while the veil opens.
 *
 * The veil closes at once instead of fading in: the page behind is the one arriving, and a load
 * finishing during the fade would show through it.
 *
 * Imperative on purpose (Web Animations API): each phase starts from where the previous one
 * stopped, which CSS transitions don't chain reliably. Without `element.animate` (tests, old
 * browsers) or with reduced motion, the curtain simply shows and hides.
 */

export interface CurtainElements {
  root: HTMLElement;
  veil: HTMLElement;
  /** The whole logo: it dives at the exit and carries `data-spin` while waiting. */
  hero: Element;
  /** The roof, the receipt of the mark, dropped in from above. */
  roof: Element;
  /** The teal diamond, which lands with a turn and spins while waiting. */
  gem: Element;
  /** « Tekad » and « bexio · Revolut · UBS ». */
  word: Element;
  /** « Réconciliation des frais ». */
  tagline: Element;
}

export interface CurtainOptions {
  reducedMotion: boolean;
  /** First page of the session: the curtain drops at once, without the delay. */
  splash: boolean;
  /** A shorter load never shows the curtain. */
  showDelayMs?: number;
  /** A release followed by a new hold within this delay keeps the curtain. */
  releaseGraceMs?: number;
}

export interface CurtainController {
  setHeld(held: boolean): void;
  dispose(): void;
}

const ARRIVE = "cubic-bezier(.2, .8, .3, 1)"; // fast, then settles
const PLUNGE = "cubic-bezier(.6, 0, .9, .4)";

const ROOF_MS = 620;
const GEM_DELAY_MS = 300;
const GEM_MS = 520;
const WORD_DELAY_MS = 480;
const WORD_MS = 420;
const TAGLINE_DELAY_MS = 680;
const TAGLINE_MS = 320;
const LEAVE_MS = 640;
const TEXT_OUT_MS = 200;
const VEIL_OPEN_DELAY_MS = 220;
const VEIL_OPEN_MS = 420;
// A background tab may never finish an animation: a timer closes the phase.
const SAFETY_NET_MS = 1600;

type Phase = "hidden" | "waiting" | "entering" | "holding" | "leaving";

export function createCurtainController(
  elements: CurtainElements,
  {
    reducedMotion,
    splash,
    showDelayMs = 150,
    releaseGraceMs = 120,
  }: CurtainOptions,
): CurtainController {
  const { root, veil, hero, roof, gem, word, tagline } = elements;
  const animated = !reducedMotion && typeof hero.animate === "function";

  let phase: Phase = "hidden";
  let held = false;
  let splashPending = splash;
  let generation = 0; // each phase voids the callbacks of the previous one
  let running: Animation[] = [];
  let showTimer: ReturnType<typeof setTimeout> | undefined;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let netTimer: ReturnType<typeof setTimeout> | undefined;

  function animate(
    element: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    const animation = element.animate(keyframes, options);
    running.push(animation);
    return animation;
  }

  function cancelAnimations() {
    running.forEach((animation) => animation.cancel());
    running = [];
    clearTimeout(netTimer);
  }

  /** Runs `next` once every animation has finished, or at the safety net. */
  function whenSettled(animations: Animation[], next: () => void) {
    const gen = generation;
    let done = false;
    const finish = () => {
      if (done || gen !== generation) return;
      done = true;
      next();
    };
    Promise.all(animations.map((animation) => animation.finished)).then(
      finish,
      () => {}, // cancelled: a newer phase took over
    );
    netTimer = setTimeout(finish, SAFETY_NET_MS);
  }

  function setSpin(on: boolean) {
    const dataset = (hero as HTMLElement | SVGElement).dataset;
    if (on) dataset.spin = "true";
    else delete dataset.spin;
  }

  function hide() {
    generation += 1;
    cancelAnimations();
    phase = "hidden";
    setSpin(false);
    delete root.dataset.shown;
  }

  function enter() {
    generation += 1;
    cancelAnimations();
    phase = "entering";
    setSpin(false);
    root.dataset.shown = "true";
    if (!animated) {
      settleEntered();
      return;
    }
    // `fill: backwards`: each part waits in its start state, then returns to its natural state —
    // nothing stays set that would get in the way of the spin.
    const drop = animate(
      roof,
      [
        { transform: "translateY(-70px)", opacity: 0, easing: ARRIVE },
        { offset: 0.3, opacity: 1 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: ROOF_MS, fill: "backwards" },
    );
    const land = animate(
      gem,
      [
        { transform: "scale(.2) rotate(-180deg)", opacity: 0, easing: ARRIVE },
        {
          offset: 0.7,
          transform: "scale(1.12) rotate(8deg)",
          opacity: 1,
          easing: "ease-in-out",
        },
        { transform: "scale(1) rotate(0)", opacity: 1 },
      ],
      { duration: GEM_MS, delay: GEM_DELAY_MS, fill: "backwards" },
    );
    const reveal = animate(
      word,
      [
        {
          clipPath: "inset(0 100% 0 0)",
          transform: "translateY(6px)",
          opacity: 0,
          easing: ARRIVE,
        },
        { clipPath: "inset(0 0 0 0)", transform: "translateY(0)", opacity: 1 },
      ],
      { duration: WORD_MS, delay: WORD_DELAY_MS, fill: "backwards" },
    );
    const caption = animate(
      tagline,
      [
        { opacity: 0, letterSpacing: "0.6em", easing: ARRIVE },
        { opacity: 1, letterSpacing: "0.32em" },
      ],
      { duration: TAGLINE_MS, delay: TAGLINE_DELAY_MS, fill: "backwards" },
    );
    whenSettled([drop, land, reveal, caption], settleEntered);
  }

  function settleEntered() {
    phase = "holding";
    setSpin(true);
    if (!held) leave();
  }

  function leave() {
    if (!animated) {
      hide();
      return;
    }
    generation += 1;
    cancelAnimations();
    phase = "leaving";
    for (const text of [word, tagline]) {
      animate(
        text,
        [
          { opacity: 1, transform: "translateY(0)" },
          { opacity: 0, transform: "translateY(8px)" },
        ],
        { duration: TEXT_OUT_MS, easing: "ease-in", fill: "forwards" },
      );
    }
    const plunge = animate(
      hero,
      [
        { offset: 0, transform: "scale(1)", opacity: 1, easing: "ease-out" },
        { offset: 0.22, transform: "scale(.94)", opacity: 1, easing: PLUNGE },
        { offset: 0.7, opacity: 1 },
        { offset: 1, transform: "scale(16)", opacity: 0 },
      ],
      { duration: LEAVE_MS, fill: "forwards" },
    );
    const opening = animate(veil, [{ opacity: 1 }, { opacity: 0 }], {
      delay: VEIL_OPEN_DELAY_MS,
      duration: VEIL_OPEN_MS,
      easing: "cubic-bezier(.45, 0, .25, 1)",
      fill: "both",
    });
    whenSettled([plunge, opening], hide);
  }

  function release() {
    held = false;
    if (phase === "waiting") {
      clearTimeout(showTimer);
      phase = "hidden";
    } else if (phase === "holding") {
      leave();
    }
    // entering: `settleEntered` leaves once the mark is assembled.
  }

  return {
    setHeld(next) {
      if (next) {
        clearTimeout(releaseTimer);
        releaseTimer = undefined;
        if (held) return;
        held = true;
        if (splashPending) {
          splashPending = false;
          enter();
        } else if (phase === "hidden") {
          phase = "waiting";
          showTimer = setTimeout(enter, showDelayMs);
        } else if (phase === "leaving") {
          enter();
        }
        return;
      }
      splashPending = false;
      if (!held || releaseTimer !== undefined) return;
      releaseTimer = setTimeout(() => {
        releaseTimer = undefined;
        release();
      }, releaseGraceMs);
    },
    dispose() {
      clearTimeout(showTimer);
      clearTimeout(releaseTimer);
      hide();
    },
  };
}
