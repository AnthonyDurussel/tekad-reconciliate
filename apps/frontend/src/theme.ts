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
 * Charte TekAD (www.tekad.ch) : le vert de la barre du logo (`#16DB65`,
 * nuance 5) pour l'accent, une nuance plus profonde (`#0A9E46`, nuance 7)
 * pour l'action sur fond clair, et le noir du site (`#0D1012`) pour la
 * navigation et les bandeaux. Barlow porte l'interface.
 */
const tekad: MantineColorsTuple = [
  "#e8fcf0",
  "#c9f6da",
  "#97eeb8",
  "#5fe593",
  "#33de74",
  "#16db65",
  "#0fbf55",
  "#0a9e46",
  "#077f38",
  "#04622b",
];

/** Le noir TekAD de la navigation et des bandeaux. */
const slate: MantineColorsTuple = [
  "#f4f5f5",
  "#e4e6e7",
  "#c8cccd",
  "#a9afb1",
  "#8b9295",
  "#6e7679",
  "#52595c",
  "#373d40",
  "#1f2426",
  "#0d1012",
];

export const BRAND = {
  primary: "#0A9E46",
  primaryLight: "#16DB65",
  text: "#16191b",
  ink: "#0D1012",
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
  primaryShade: { light: 7, dark: 5 },
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
