import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  P0_PREPARATION_FILENAME_PREFIX,
  P0_PREPARATION_TIME_ZONE,
  createP0DecisionPreparationPack,
  serializeP0DecisionPreparationPack,
} from "../lib/p0-decision-preparation";

const PLACEHOLDER = "__P0_INITIAL_PACK_JSON__";
const MAX_TEMPLATE_BYTES = 1_500_000;

function outputDirectoryFromArgs(argv: string[]) {
  if (argv.length !== 2 || argv[0] !== "--output-dir" || !argv[1]) {
    throw new Error("Usage: generate-p0-decision-preparation --output-dir <new-or-existing-directory>");
  }
  return path.resolve(argv[1]);
}

function calendarDate(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: P0_PREPARATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function safeEmbeddedJson(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

async function main() {
  const outputDirectory = outputDirectoryFromArgs(process.argv.slice(2));
  await mkdir(outputDirectory, { recursive: true });
  const outputDirectoryStat = await lstat(outputDirectory);
  if (!outputDirectoryStat.isDirectory() || outputDirectoryStat.isSymbolicLink()) {
    throw new Error("Output target must be a real directory, not a symlink");
  }

  const generatedAt = new Date().toISOString();
  const pack = createP0DecisionPreparationPack({ generatedAt });
  const date = calendarDate(generatedAt);
  const jsonFilename = `${P0_PREPARATION_FILENAME_PREFIX}_${date}.json`;
  const htmlFilename = `${P0_PREPARATION_FILENAME_PREFIX}_${date}.html`;
  const jsonPath = path.join(outputDirectory, jsonFilename);
  const htmlPath = path.join(outputDirectory, htmlFilename);

  const templatePath = fileURLToPath(new URL("../templates/p0-decision-preparation.html", import.meta.url));
  const templateStat = await lstat(templatePath);
  if (!templateStat.isFile() || templateStat.size > MAX_TEMPLATE_BYTES) {
    throw new Error("Invalid P0 preparation HTML template");
  }
  const template = await readFile(templatePath, "utf8");
  if (template.split(PLACEHOLDER).length !== 2) {
    throw new Error("P0 preparation HTML template must contain exactly one initial-pack placeholder");
  }
  const html = template.replace(PLACEHOLDER, safeEmbeddedJson(pack));

  await writeFile(jsonPath, serializeP0DecisionPreparationPack(pack), { encoding: "utf8", flag: "wx" });
  await writeFile(htmlPath, html, { encoding: "utf8", flag: "wx" });

  process.stdout.write(`${JSON.stringify({
    protocolVersion: pack.protocolVersion,
    status: pack.status,
    formalResolved: pack.summary.formalResolved,
    draftFieldsComplete: pack.summary.draftFieldsComplete,
    contentSha256: pack.contentSha256,
    jsonPath,
    htmlPath,
  }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "P0 preparation generation failed"}\n`);
  process.exitCode = 1;
});
