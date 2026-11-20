import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { createCurtainController } from "./curtainController";
import classes from "./LoadingCurtainHost.module.css";
import {
  isFirstPageOfSession,
  isLoadingCurtainHeld,
  subscribeLoadingCurtain,
} from "./loadingCurtainStore";
import { GEM_PATH, LOGO_VIEWBOX, ROOF_PATH } from "./logoPaths";

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The full-screen loading curtain, mounted once (`App.tsx`, after the tree whose
 * `LoadingScreen`s hold it). It shows while a `LoadingScreen`
 * is mounted somewhere, and can therefore play its exit after the fallback that asked for it is
 * gone.
 */
export function LoadingCurtainHost() {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<SVGSVGElement>(null);
  const roofRef = useRef<SVGPathElement>(null);
  const gemRef = useRef<SVGPathElement>(null);
  const wordRef = useRef<SVGGElement>(null);
  const taglineRef = useRef<SVGTextElement>(null);

  // A layout effect, subscribed to the store directly: the curtain closes before the first paint,
  // and the holds taken in the same commit are not missed.
  useLayoutEffect(() => {
    const controller = createCurtainController(
      {
        root: rootRef.current!,
        veil: veilRef.current!,
        hero: heroRef.current!,
        roof: roofRef.current!,
        gem: gemRef.current!,
        word: wordRef.current!,
        tagline: taglineRef.current!,
      },
      {
        reducedMotion: prefersReducedMotion(),
        // What loads at start-up opens on the full pass, once per session.
        splash: isFirstPageOfSession() && isLoadingCurtainHeld(),
      },
    );
    const sync = () => controller.setHeld(isLoadingCurtainHeld());
    sync();
    const unsubscribe = subscribeLoadingCurtain(sync);
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={classes.curtain}
      aria-hidden="true"
      data-testid="loading-curtain"
    >
      <div ref={veilRef} className={classes.veil} />
      {/* The TekAD logo in one SVG, so that its parts can move. */}
      <svg ref={heroRef} className={classes.hero} viewBox="-20 -20 800 230">
        <svg x="0" y="0" width="560" height="161" viewBox={LOGO_VIEWBOX}>
          <path ref={roofRef} className={classes.roof} d={ROOF_PATH} />
          <g className={classes.spin}>
            <path ref={gemRef} className={classes.gem} d={GEM_PATH} />
          </g>
        </svg>
        <g ref={wordRef}>
          <text className={classes.line} x="600" y="96">
            Frais
          </text>
          <text className={classes.line} x="600" y="128">
            bexio · Revolut
          </text>
        </g>
        <text ref={taglineRef} className={classes.tagline} x="280" y="200">
          {t("app.subtitle")}
        </text>
      </svg>
    </div>
  );
}
