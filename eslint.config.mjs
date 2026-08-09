import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "next-env.d.ts",
    "lib/legacy-content.generated.ts",
    "script.js",
    "workspace.js",
    "resources.js",
    "public/**",
    "scripts/generate-pages.mjs",
    "scripts/serve.mjs",
  ]),
]);
