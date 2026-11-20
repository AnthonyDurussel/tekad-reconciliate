import {
  ActionIcon,
  Badge,
  Button,
  Card,
  createTheme,
  Drawer,
  Loader,
  Modal,
  Paper,
  Popover,
  Table,
  type MantineColorsTuple,
} from "@mantine/core";
import { DiamondLoader } from "./components/loading/DiamondLoader";

/**
 * Charte Tekad · Réconciliation des frais : un sarcelle profond (`#0B8577`,
 * nuance 7) pour l'action, sur une encre bleu nuit (`#0F1C2B`) pour la
 * navigation et les bandeaux — sobre, lisible, « finance ». Inter n'est pas
 * chargée : Barlow, grotesque libre aux chiffres nets, porte l'interface.
 */
const tekad: MantineColorsTuple = [
  "#e6fbf8",
  "#cdf3ee",
  "#9de6dc",
  "#69d8c9",
  "#3fcbb8",
  "#24c1ad",
  "#0f9e8e",
  "#0b8577",
  "#076c61",
  "#03564d",
];

/** Encre bleu nuit de la navigation et des bandeaux. */
const slate: MantineColorsTuple = [
  "#f2f5f8",
  "#e2e8ee",
  "#c5d0db",
  "#a5b4c3",
  "#8698ab",
  "#687d93",
  "#4d6178",
  "#34475d",
  "#1d3047",
  "#0f1c2b",
];

export const BRAND = {
  primary: "#0B8577",
  primaryLight: "#3FCBB8",
  text: "#1b2733",
  ink: "#0F1C2B",
};

export const theme = createTheme({
  fontFamily: "Barlow, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  headings: {
    fontFamily:
      "Barlow, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    fontWeight: "600",
  },
  colors: { tekad, slate },
  primaryColor: "tekad",
  primaryShade: { light: 7, dark: 6 },
  autoContrast: true,
  luminanceThreshold: 0.45,
  defaultRadius: "md",
  radius: { xs: "6px", sm: "8px", md: "12px", lg: "16px", xl: "20px" },
  black: BRAND.text,
  cursorType: "pointer",
  focusRing: "auto",
  components: {
    // The diamond of the Tekad mark wherever something loads.
    Loader: Loader.extend({
      defaultProps: {
        loaders: { ...Loader.defaultLoaders, diamond: DiamondLoader },
        type: "diamond",
      },
    }),
    Button: Button.extend({ styles: { root: { fontWeight: 600 } } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { radius: "md" } }),
    // Frosted surfaces over the ground of `global.css`.
    Card: Card.extend({ classNames: { root: "app-surface" } }),
    Paper: Paper.extend({ defaultProps: { radius: "lg" } }),
    Badge: Badge.extend({ defaultProps: { radius: "xl" } }),
    // A quiet uppercase header band, like a ledger.
    Table: Table.extend({
      defaultProps: { fz: "sm" },
      classNames: { thead: "app-table-head" },
    }),
    Modal: Modal.extend({
      defaultProps: {
        closeOnClickOutside: false,
        radius: "lg",
        overlayProps: { backgroundOpacity: 0.45, blur: 3 },
      },
    }),
    Drawer: Drawer.extend({ defaultProps: { closeOnClickOutside: false } }),
    Popover: Popover.extend({ defaultProps: { zIndex: 600 } }),
  },
});
