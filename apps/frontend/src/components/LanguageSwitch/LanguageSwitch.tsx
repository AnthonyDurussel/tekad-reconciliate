import { SegmentedControl, type SegmentedControlProps } from "@mantine/core";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

/** Choix de la langue de l'interface, retenu dans le navigateur. */
export default function LanguageSwitch(
  props: Omit<SegmentedControlProps, "data" | "value" | "onChange">,
) {
  const { i18n } = useTranslation();
  return (
    <SegmentedControl
      size="xs"
      {...props}
      data={LANGUAGES}
      value={i18n.language.startsWith("en") ? "en" : "fr"}
      onChange={(language) => {
        i18n.changeLanguage(language);
        try {
          localStorage.setItem("tekad-language", language);
        } catch {
          // stockage indisponible
        }
      }}
    />
  );
}
