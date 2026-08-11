import Script from "next/script";

import { legacyPages, type LegacyPageKey } from "@/lib/legacy-content.generated";
import type { NavigationKey } from "@/lib/site";
import { SiteShell } from "@/components/site-shell";

export type RoutedLegacyPageKey = Exclude<LegacyPageKey, "not-found">;

export function LegacyPage({ pageKey }: { pageKey: RoutedLegacyPageKey }) {
  const page = legacyPages[pageKey];
  return (
    <SiteShell
      pageKey={page.nav as NavigationKey}
      sofiaSurface="floating"
    >
      {page.jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: page.jsonLd }}
        />
      ) : null}
      <div className="legacy-page-root" dangerouslySetInnerHTML={{ __html: page.mainHtml }} />
      {page.runtime === "workspace" ? (
        <Script id="sufeiya-workspace-runtime" src="/workspace.js" strategy="afterInteractive" />
      ) : null}
      {page.runtime === "resources" ? (
        <Script id="sufeiya-resources-runtime" src="/resources.js" strategy="afterInteractive" />
      ) : null}
      {page.journey ? (
        <Script id="sufeiya-journey-runtime" src="/journey.js" strategy="afterInteractive" />
      ) : null}
    </SiteShell>
  );
}
