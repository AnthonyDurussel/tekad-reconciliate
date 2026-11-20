import { VisuallyHidden } from "@mantine/core";
import { useLayoutEffect } from "react";
import { useTranslation } from "react-i18next";
import { holdLoadingCurtain } from "./loadingCurtainStore";

/**
 * Full-screen loading: holds the curtain (`LoadingCurtainHost`, mounted once in `App.tsx`)
 * while mounted (a layout effect: before the first paint). Renders only a status for assistive technologies; the curtain is decorative.
 */
export default function LoadingScreen() {
  const { t } = useTranslation();
  useLayoutEffect(() => holdLoadingCurtain(), []);
  return (
    <VisuallyHidden role="status" aria-live="polite">
      {t("common.loading")}
    </VisuallyHidden>
  );
}
