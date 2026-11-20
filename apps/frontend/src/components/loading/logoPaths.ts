/**
 * The Tekad mark as path data, so that the loading curtain can animate its parts: the roof
 * (a receipt, its torn edge pointing down) and the gem (the teal diamond under it — the receipt
 * meets its transaction). The wordmark is drawn as text by `LoadingCurtainHost`. Coordinates
 * are those of `public/logo-tekad.svg`.
 */

/** The receipt, with three lines cut out (even-odd fill). */
export const ROOF_PATH =
  "M84,0 L152,0 Q158,0 158,6 L158,76 L153,84 L148,76 L143,84 L138,76 L133,84 L128,76 L123,84 L118,76 L113,84 L108,76 L103,84 L98,76 L93,84 L88,76 L83,84 L78,76 L78,6 Q78,0 84,0 Z M92,16 L144,16 L144,25 L92,25 Z M92,35 L144,35 L144,44 L92,44 Z M92,54 L126,54 L126,63 L92,63 Z";

export const GEM_PATH =
  "M118.383,84.871 L148.045,114.534 L118.383,144.196 L88.721,114.534 L118.383,84.871 z";

/** Centre of the diamond. */
export const GEM_CENTRE = { x: 118.383, y: 114.534 } as const;
