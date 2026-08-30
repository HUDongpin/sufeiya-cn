import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("pins the Owner-approved Alibaba Cloud staging boundary", async () => {
  const contract = JSON.parse(await read("deploy/alicloud-fc/phase0-staging.v1.json"));

  assert.deepEqual(
    {
      functionName: contract.function.name,
      region: contract.function.region,
      cpu: contract.resources.cpu,
      memoryMiB: contract.resources.memoryMiB,
      minimumInstances: contract.resources.minimumInstances,
      maximumInstances: contract.resources.maximumInstances,
      instanceConcurrency: contract.resources.instanceConcurrency,
      createSls: contract.logging.createSls,
      customHostname: contract.network.customHostname,
      dnsScope: contract.network.dnsScope,
      monthlyBudget: contract.budget.monthlyBudget,
      enforcement: contract.budget.enforcement,
      canonicalCutover: contract.network.canonicalCutover,
      productionPromotionAuthorized: contract.release.productionPromotionAuthorized,
    },
    {
      functionName: "sufeiya-phase0-preview-71f2982",
      region: "cn-beijing",
      cpu: 0.5,
      memoryMiB: 512,
      minimumInstances: 0,
      maximumInstances: 1,
      instanceConcurrency: 8,
      createSls: false,
      customHostname: "phase0-preview.sufeiya.cn",
      dnsScope: "exact-host-only",
      monthlyBudget: 200,
      enforcement: "alert-only-not-a-hard-cap",
      canonicalCutover: false,
      productionPromotionAuthorized: false,
    },
  );
});

test("keeps Vercel builds default and makes FC standalone packaging explicit", async () => {
  const [nextConfig, packageScript, dockerfile] = await Promise.all([
    read("next.config.ts"),
    read("scripts/package-alicloud-fc.mjs"),
    read("deploy/alicloud-fc/Dockerfile.package"),
  ]);

  assert.match(nextConfig, /SUFEIYA_DEPLOY_TARGET === "alicloud-fc"/);
  assert.match(nextConfig, /isAlicloudFcBuild \? \{ output: "standalone" as const \} : \{\}/);
  assert.match(packageScript, /ELF_X86_64_MACHINE = 62/);
  assert.match(packageScript, /exec \/code\/runtime\/node \/code\/server\.js/);
  assert.match(packageScript, /KEEP_ALIVE_TIMEOUT="86400000"/);
  assert.match(dockerfile, /FROM --platform=linux\/amd64 node:24\.20\.0-bookworm-slim/);
});
