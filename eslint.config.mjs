import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import playwright from "eslint-plugin-playwright";
import prettier from "eslint-config-prettier";

const appFiles = [
  "app/**/*.{js,jsx,ts,tsx}",
  "components/**/*.{js,jsx,ts,tsx}",
  "lib/**/*.{js,jsx,ts,tsx}",
  "src/**/*.{js,jsx,ts,tsx}",
];

const testFiles = ["tests/**/*.{js,jsx,ts,tsx}"];
const testLanguageOptions = nextVitals[0].languageOptions;

function scopeConfigsToFiles(configs, files) {
  return configs.map((config) => ({
    ...config,
    files,
  }));
}

export default defineConfig([
  ...scopeConfigsToFiles(nextVitals, appFiles),
  ...scopeConfigsToFiles(nextTs, appFiles),
  {
    files: testFiles,
    languageOptions: testLanguageOptions,
    plugins: {
      playwright,
    },
    rules: {
      ...playwright.configs.recommended.rules,
      "playwright/no-wait-for-timeout": "warn",
      "playwright/prefer-locator": "warn",
    },
  },
  prettier,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "out/**",
    "build/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);
