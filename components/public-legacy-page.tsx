import Script from "next/script";

import { PublicSiteShell } from "@/components/public-site-shell";
import { legacyPages, type LegacyPageKey } from "@/lib/legacy-content.generated";
import type { NavigationKey } from "@/lib/site";
import type { ReactNode } from "react";

export type PublicLegacyPageKey = Extract<
  LegacyPageKey,
  "home" | "learning-path" | "platform" | "about" | "my-data"
>;

export function PublicLegacyPage({
  pageKey,
  afterLegacyContent,
}: {
  pageKey: PublicLegacyPageKey;
  afterLegacyContent?: ReactNode;
}) {
  const page = legacyPages[pageKey];
  const localDataPage = pageKey === "my-data";
  const mainMatch = afterLegacyContent
    ? page.mainHtml
        .trim()
        .match(
          /^<main id="main-content"(?: class="([a-z0-9_-]+(?: [a-z0-9_-]+)*)")?>([\s\S]*)<\/main>$/,
        )
    : null;
  if (afterLegacyContent && !mainMatch) {
    throw new Error(`Public legacy page ${pageKey} is missing the expected main boundary`);
  }

  return (
    <PublicSiteShell
      pageKey={page.nav as NavigationKey}
      sofiaIntroduction={!localDataPage}
    >
      {page.jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: page.jsonLd }}
        />
      ) : null}
      {mainMatch ? (
        <main id="main-content" className={mainMatch[1] || undefined}>
          <div
            className="legacy-page-root"
            dangerouslySetInnerHTML={{ __html: mainMatch[2] }}
          />
          {afterLegacyContent}
        </main>
      ) : (
        <div
          className="legacy-page-root"
          dangerouslySetInnerHTML={{ __html: page.mainHtml }}
        />
      )}
      {page.runtime === "workspace" ? (
        <Script id="sufeiya-public-workspace-runtime" src="/workspace.js" strategy="afterInteractive" />
      ) : null}
      {page.journey ? (
        <Script id="sufeiya-public-journey-runtime" src="/journey.js" strategy="afterInteractive" />
      ) : null}
    </PublicSiteShell>
  );
}
