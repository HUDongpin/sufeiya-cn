import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const entryPoint = fileURLToPath(new URL("./clerk-production-invitation.ts", import.meta.url));
const outputPath = fileURLToPath(
  new URL("./clerk-production-invitation-owner.mjs", import.meta.url),
);
const checkOnly = process.argv.length === 3 && process.argv[2] === "--check";

if (!checkOnly && process.argv.length !== 2) {
  throw new Error("Use this generator with no arguments or the exact --check argument.");
}

const result = await build({
  bundle: true,
  entryPoints: [entryPoint],
  format: "esm",
  legalComments: "none",
  logLevel: "silent",
  outfile: outputPath,
  platform: "node",
  target: "node24",
  write: !checkOnly,
});

if (checkOnly) {
  const generated = result.outputFiles?.[0]?.contents;
  if (!generated) throw new Error("Owner runtime generation produced no output.");
  const committed = await readFile(outputPath);
  if (!Buffer.from(generated).equals(committed)) {
    throw new Error("Committed Clerk Production Owner runtime is stale.");
  }
}
