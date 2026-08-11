import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

import { inspectP0DecisionPreparationPack } from "../lib/p0-decision-preparation";

const MAX_PACK_BYTES = 2 * 1024 * 1024;

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length !== 1 || !argv[0]) {
    throw new Error("Usage: validate-p0-decision-preparation <draft-json-file>");
  }
  const inputPath = path.resolve(argv[0]);
  const stat = await lstat(inputPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_PACK_BYTES) {
    throw new Error("Input must be a regular JSON file no larger than 2 MiB");
  }
  const candidate = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  const inspection = inspectP0DecisionPreparationPack(candidate);
  const pack = inspection.pack;
  process.stdout.write(`${JSON.stringify({
    validUnsignedIntegrity: true,
    currentBindingStatus: inspection.currentBindingStatus,
    staleReasons: inspection.staleReasons,
    protocolVersion: pack.protocolVersion,
    status: pack.status,
    revision: pack.revision,
    summary: pack.summary,
    authorityBoundary: pack.authorityBoundary,
    contentSha256: pack.contentSha256,
  }, null, 2)}\n`);
  if (inspection.currentBindingStatus !== "current") process.exitCode = 2;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "P0 preparation validation failed"}\n`);
  process.exitCode = 1;
});
