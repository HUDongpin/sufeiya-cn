import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function source(path: string) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Clerk-free public route shell", () => {
  it("keeps the shared public shell free of Clerk, request headers, and dynamic rendering", async () => {
    const publicShell = await source("components/public-site-shell.tsx");
    for (const forbidden of [
      "@clerk",
      'from "@/components/site-shell"',
      "<SiteShell",
      "headers()",
      "connection()",
      "ClerkProvider",
    ]) {
      assert.equal(publicShell.includes(forbidden), false, forbidden);
    }
    assert.match(publicShell, /PublicAnalytics/);
    assert.match(publicShell, /enabled=\{process\.env\.VERCEL_ENV === "production"\}/);
    assert.match(publicShell, /SofiaPublicFloatingAssistant/);
  });

  it("routes marketing, resources, Sofia introduction, and local data through public components", async () => {
    const routes = await Promise.all([
      "app/page.tsx",
      "app/learning-path/page.tsx",
      "app/platform/page.tsx",
      "app/resources/page.tsx",
      "app/about/page.tsx",
      "app/super-teacher/page.tsx",
      "app/my-data/page.tsx",
    ].map(source));
    for (const route of routes) {
      assert.doesNotMatch(route, /@clerk|RoutedLegacyPage|components\/site-shell|<SiteShell/);
    }
    assert.match(routes[5], /SofiaPublicPage/);
    assert.doesNotMatch(routes[5], /SuperTeacherClient/);
    assert.match(routes[6], /robots: \{ index: false, follow: false \}/);
  });

  it("does not mount analytics or the Sofia introduction on the local data page", async () => {
    const legacyPage = await source("components/public-legacy-page.tsx");
    assert.match(legacyPage, /analytics=\{!localDataPage\}/);
    assert.match(legacyPage, /sofiaIntroduction=\{!localDataPage\}/);
    assert.doesNotMatch(legacyPage, /legacy-runtime-scripts|lib\/learning|learning-domain/);
    assert.match(legacyPage, /src="\/workspace\.js"/);
    assert.match(legacyPage, /src="\/journey\.js"/);
  });

  it("separates the public Sofia introduction from the protected local interaction", async () => {
    const [publicRoute, protectedRoute] = await Promise.all([
      source("app/super-teacher/page.tsx"),
      source("app/workspace/sofia/page.tsx"),
    ]);
    assert.match(publicRoute, /SofiaPublicPage/);
    assert.doesNotMatch(publicRoute, /SuperTeacherClient|components\/site-shell|<SiteShell/);
    assert.match(protectedRoute, /SuperTeacherClient/);
    assert.match(protectedRoute, /SiteShell/);
    assert.match(protectedRoute, /robots: \{ index: false, follow: false \}/);
  });
});
