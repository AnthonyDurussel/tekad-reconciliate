import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintReact from "@eslint-react/eslint-plugin";
import { globalIgnores } from "eslint/config";

export default [
  globalIgnores([
    "**/dist/**",
    "**/dev-dist/**",
    "**/storybook-static/**",
    "**/mock/**",
  ]),
  {
    files: ["**/*.{ts,tsx}"],

    languageOptions: {
      parser: tsparser,
      sourceType: "module",
    },

    plugins: {
      "@typescript-eslint": tseslint,
      prettier: prettierPlugin,
      ...eslintReact.configs["recommended-typescript"].plugins,
      "unused-imports": unusedImports,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },

    settings: eslintReact.configs["recommended-typescript"].settings,

    rules: {
      ...tseslint.configs.recommended.rules,
      ...prettierConfig.rules,
      ...reactHooks.configs.recommended.rules,
      ...eslintReact.configs["recommended-typescript"].rules,
      // Doublons des règles officielles d'eslint-plugin-react-hooks.
      ...Object.fromEntries(
        [
          "exhaustive-deps",
          "purity",
          "rules-of-hooks",
          "set-state-in-effect",
          "set-state-in-render",
          "static-components",
          "use-memo",
        ].map((rule) => [`@eslint-react/${rule}`, "off"]),
      ),
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-console": "off",
      semi: ["error", "always"],
      quotes: ["error", "double"],
      "prettier/prettier": "error",
    },
  },
];
