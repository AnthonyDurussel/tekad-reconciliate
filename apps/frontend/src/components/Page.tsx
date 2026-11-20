import type { ReactNode } from "react";
import { Box } from "@mantine/core";

/** Conteneur de page : marges et largeur maximale homogènes. */
export default function Page({
  children,
  maxWidth = 1400,
}: {
  children: ReactNode;
  maxWidth?: number;
}) {
  return (
    <Box p={{ base: "md", md: "xl" }} maw={maxWidth} mx="auto">
      {children}
    </Box>
  );
}
