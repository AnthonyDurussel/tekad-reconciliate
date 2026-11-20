#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lire le fichier fr.json
const frJsonPath = path.join(__dirname, "src/locales/lang/fr.json");
const frJson = JSON.parse(fs.readFileSync(frJsonPath, "utf8"));

// Fonction pour extraire toutes les clés d'un objet JSON
function extractKeys(obj, prefix = "") {
  const keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (
      typeof obj[key] === "object" &&
      obj[key] !== null &&
      !Array.isArray(obj[key])
    ) {
      keys.push(...extractKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Extraire toutes les clés du fichier fr.json
const existingKeys = new Set(extractKeys(frJson));

// Fonction pour extraire les clés de traduction du code source
function extractKeysFromCode(dir) {
  const keys = new Set();
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!file.startsWith(".") && file !== "node_modules") {
        extractKeysFromCode(filePath).forEach((key) => keys.add(key));
      }
    } else if (file.endsWith(".tsx") || file.endsWith(".ts")) {
      const content = fs.readFileSync(filePath, "utf8");

      // Regex pour trouver les appels à t() avec des chaînes simples
      const regex = /t\(\s*["'`]([^"'`]+)["'`]/g;
      let match;

      while ((match = regex.exec(content)) !== null) {
        const key = match[1];
        // Filtrer les clés invalides et exclure les clés enum.* et yup.* qui sont dynamiques
        // Une clé valide doit contenir au moins un point et commencer par une lettre minuscule
        if (
          key &&
          key.includes(".") &&
          /^[a-z]/.test(key) &&
          !key.startsWith("enum.") &&
          !key.startsWith("yup.") &&
          !key.includes(" ") &&
          !key.includes("/") &&
          !key.includes("${") &&
          !key.includes("$")
        ) {
          console.log(`Found key: ${key} in file: ${filePath}`);
          keys.add(key);
        }
      }
    }
  }

  return keys;
}

// Extraire les clés du code source
const srcDir = path.join(__dirname, "src");
const usedKeys = extractKeysFromCode(srcDir);

// Trouver les clés manquantes
const missingKeys = [];
for (const key of usedKeys) {
  // Pluriels i18next : `cle_one` / `cle_other` valent pour `cle`.
  if (!existingKeys.has(key) && !existingKeys.has(`${key}_other`)) {
    missingKeys.push(key);
  }
}

// Afficher les résultats
console.log(`\n📊 Rapport d'analyse des clés de traduction\n`);
console.log(`✅ Clés existantes dans fr.json: ${existingKeys.size}`);
console.log(`🔍 Clés utilisées dans le code: ${usedKeys.size}`);
console.log(`❌ Clés manquantes dans fr.json: ${missingKeys.length}\n`);

if (missingKeys.length > 0) {
  console.log(`⚠️  Clés de traduction manquantes:\n`);
  missingKeys.sort().forEach((key) => {
    console.log(`  - ${key}`);
  });
  console.log("\n");
  process.exit(1);
} else {
  console.log(`✨ Toutes les clés de traduction sont présentes!\n`);
  process.exit(0);
}
