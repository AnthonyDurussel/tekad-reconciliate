import { forwardRef, type HTMLAttributes } from "react";
import { Box, type MantineLoaderComponent } from "@mantine/core";
import classes from "./DiamondLoader.module.css";

/**
 * The app's `Loader` type (`theme.ts`): the diamond of the Tekad mark tipping over on its points,
 * drawn in `--loader-color` (the primary colour, or the button's text colour inside a button).
 */
export const DiamondLoader: MantineLoaderComponent = forwardRef<
  HTMLSpanElement,
  HTMLAttributes<HTMLSpanElement>
>(({ className, ...others }, ref) => (
  <Box
    ref={ref}
    component="span"
    className={className ? `${classes.loader} ${className}` : classes.loader}
    {...others}
  >
    <svg viewBox="0 0 48 48" className={classes.svg}>
      <path className={classes.shadow} d="M24 30 L36 42 L24 46 L12 42 Z" />
      <path className={classes.gem} d="M24 4 L40 20 L24 36 L8 20 Z" />
    </svg>
  </Box>
));
DiamondLoader.displayName = "DiamondLoader";
