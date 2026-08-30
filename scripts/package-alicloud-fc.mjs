import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdir,
  open,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const contractPath = join(root, "deploy/alicloud-fc/phase0-staging.v1.json");
const contract = JSON.parse(await readFile(contractPath, "utf8"));

const fail = (message) => {
  throw new Error(`Alibaba Cloud FC package refused: ${message}`);
};

if (
  contract?.function?.name !== "sufeiya-phase0-preview-71f2982" ||
  contract?.function?.region !== "cn-beijing" ||
  contract?.runtime?.environment !== "custom.debian12" ||
  contract?.runtime?.architecture !== "linux-x64" ||
  contract?.runtime?.nodeVersion !== "v24.20.0" ||
  contract?.runtime?.listenPort !== 9000 ||
  contract?.resources?.cpu !== 0.5 ||
  contract?.resources?.memoryMiB !== 512 ||
  contract?.resources?.minimumInstances !== 0 ||
  contract?.resources?.maximumInstances !== 1 ||
  contract?.resources?.instanceConcurrency !== 8 ||
  contract?.logging?.createSls !== false ||
  contract?.network?.customHostname !== "phase0-preview.sufeiya.cn" ||
  contract?.budget?.monthlyBudget !== 200 ||
  contract?.budget?.enforcement !== "alert-only-not-a-hard-cap" ||
  contract?.release?.environment !== "staging" ||
  contract?.release?.productionPromotionAuthorized !== false
) {
  fail("the tracked deployment contract drifted from the Owner-approved staging scope");
}

const requiredServerFiles = JSON.parse(
  await readFile(join(root, ".next/required-server-files.json"), "utf8"),
);
if (requiredServerFiles?.config?.output !== "standalone") {
  fail("the current build is not a Next.js standalone build");
}

const sourceSha = (
  process.env.SUFEIYA_SOURCE_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout
).trim();
if (!/^[a-f0-9]{40}$/.test(sourceSha)) {
  fail("SUFEIYA_SOURCE_SHA must be the exact 40-character lowercase Git SHA");
}

const nodeBinary = process.env.SUFEIYA_FC_NODE_BINARY;
if (!nodeBinary || !nodeBinary.startsWith("/")) {
  fail("SUFEIYA_FC_NODE_BINARY must name an absolute Linux x86_64 Node binary");
}

const nodeHandle = await open(nodeBinary, "r");
const elfHeader = Buffer.alloc(20);
try {
  await nodeHandle.read(elfHeader, 0, elfHeader.length, 0);
} finally {
  await nodeHandle.close();
}
const ELF_X86_64_MACHINE = 62;
if (
  elfHeader[0] !== 0x7f ||
  elfHeader.subarray(1, 4).toString("ascii") !== "ELF" ||
  elfHeader[4] !== 2 ||
  elfHeader[5] !== 1 ||
  elfHeader.readUInt16LE(18) !== ELF_X86_64_MACHINE
) {
  fail("the bundled Node binary is not a little-endian Linux x86_64 ELF executable");
}

const nodeVersionResult = spawnSync(nodeBinary, ["--version"], { encoding: "utf8" });
const nodeVersion = nodeVersionResult.stdout.trim();
if (nodeVersionResult.status !== 0 || nodeVersion !== contract.runtime.nodeVersion) {
  fail(`the bundled Node version is ${nodeVersion || "unreadable"}, expected ${contract.runtime.nodeVersion}`);
}

const artifactRoot = resolve(root, "artifacts/alicloud-fc");
const packageName = contract.function.name;
const packageDirectory = resolve(artifactRoot, packageName);
const zipPath = resolve(artifactRoot, `${packageName}.zip`);
const receiptPath = resolve(artifactRoot, `${packageName}.receipt.json`);
const checksumPath = resolve(artifactRoot, `${packageName}.sha256`);
for (const target of [packageDirectory, zipPath, receiptPath, checksumPath]) {
  if (target !== artifactRoot && !target.startsWith(`${artifactRoot}${sep}`)) {
    fail(`unsafe artifact target: ${target}`);
  }
  await rm(target, { recursive: target === packageDirectory, force: true });
}

await mkdir(join(packageDirectory, ".next"), { recursive: true });
await cp(join(root, ".next/standalone"), packageDirectory, { recursive: true });
await cp(join(root, ".next/static"), join(packageDirectory, ".next/static"), {
  recursive: true,
});
await cp(join(root, "public"), join(packageDirectory, "public"), { recursive: true });
await mkdir(join(packageDirectory, "runtime"), { recursive: true });
await cp(nodeBinary, join(packageDirectory, "runtime/node"));
await chmod(join(packageDirectory, "runtime/node"), 0o755);

const bootstrap = `#!/bin/sh
set -eu
export HOSTNAME="0.0.0.0"
export PORT="\${FC_SERVER_PORT:-9000}"
export KEEP_ALIVE_TIMEOUT="86400000"
exec /code/runtime/node /code/server.js
`;
await writeFile(join(packageDirectory, "bootstrap"), bootstrap, { mode: 0o755 });
await cp(contractPath, join(packageDirectory, "deployment-contract.json"));

const sha256 = async (path) => {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
};

const buildId = (await readFile(join(root, ".next/BUILD_ID"), "utf8")).trim();
const contractSha256 = await sha256(contractPath);
const nodeBinarySha256 = await sha256(nodeBinary);
const manifest = {
  schemaVersion: 1,
  artifactKind: "alicloud-function-compute-web-function",
  functionName: contract.function.name,
  region: contract.function.region,
  environment: contract.release.environment,
  sourceSha,
  nextBuildId: buildId,
  runtime: {
    nodeVersion,
    architecture: contract.runtime.architecture,
    nodeBinarySha256,
  },
  deploymentContractSha256: contractSha256,
  canonicalCutover: false,
};
const manifestPath = join(packageDirectory, "artifact-manifest.json");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

await mkdir(dirname(zipPath), { recursive: true });
const zipResult = spawnSync("zip", ["-X", "-q", "-r", zipPath, "."], {
  cwd: packageDirectory,
  encoding: "utf8",
});
if (zipResult.status !== 0) {
  fail(`zip failed: ${(zipResult.stderr || zipResult.stdout || "unknown error").trim()}`);
}

const artifactSha256 = await sha256(zipPath);
const artifactBytes = (await stat(zipPath)).size;
const packageManifestSha256 = await sha256(manifestPath);
const receipt = {
  schemaVersion: 1,
  functionName: contract.function.name,
  region: contract.function.region,
  environment: contract.release.environment,
  sourceSha,
  nextBuildId: buildId,
  artifact: {
    path: relative(root, zipPath),
    bytes: artifactBytes,
    sha256: artifactSha256,
  },
  packageManifestSha256,
  deploymentContractSha256: contractSha256,
  nodeVersion,
  nodeBinarySha256,
  logDestination: null,
  canonicalCutover: false,
};
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
await writeFile(checksumPath, `${artifactSha256}  ${basename(zipPath)}\n`);

process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
