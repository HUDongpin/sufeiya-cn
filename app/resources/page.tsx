import { PublicSiteShell } from "@/components/public-site-shell";
import { ResourceCatalog } from "@/components/resource-catalog";
import { legacyPages } from "@/lib/legacy-content.generated";
import {
  filterResources,
  parseResourceFilters,
  splitLegacyResourcesMain,
} from "@/lib/resources";
import { metadataForPage } from "@/lib/site";

export const metadata = metadataForPage("resources");

const { beforeCatalogHtml, afterCatalogHtml } = splitLegacyResourcesMain(
  legacyPages.resources.mainHtml,
);

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ query?: string | string[]; skill?: string | string[] }>;
}) {
  const filters = parseResourceFilters(await searchParams);
  const resources = filterResources(filters);

  return (
    <PublicSiteShell pageKey="resources">
      {legacyPages.resources.jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: legacyPages.resources.jsonLd }}
        />
      ) : null}
      <main id="main-content">
        <div className="legacy-page-root" dangerouslySetInnerHTML={{ __html: beforeCatalogHtml }} />
        <ResourceCatalog {...filters} resources={resources} />
        <div className="legacy-page-root" dangerouslySetInnerHTML={{ __html: afterCatalogHtml }} />
      </main>
    </PublicSiteShell>
  );
}
