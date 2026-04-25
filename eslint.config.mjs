import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import playwright from "eslint-plugin-playwright";
import prettier from "eslint-config-prettier";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["tests/**/*.{ts,tsx}"],
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
