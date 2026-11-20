import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import fr from "./lang/fr.json";
import en from "./lang/en.json";

export const SUPPORTED_LANGUAGES = ["fr", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem("tekad-language");
    if (stored === "en" || stored === "fr") return stored;
  } catch {
    // stockage indisponible
  }
  return "fr";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    lng: initialLanguage(),
    fallbackLng: "fr",
    interpolation: { escapeValue: false },
  });
}

export default i18n;
