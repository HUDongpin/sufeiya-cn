import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegacyPage } from "@/components/legacy-page";
import { legacyPages, publicRouteSlugs, type LegacyPageKey } from "@/lib/legacy-content.generated";
import { metadataForPage } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return publicRouteSlugs.map((slug) => ({ slug }));
}

function routeKey(slug: string): LegacyPageKey | null {
  if (slug === "home" || slug === "not-found") return null;
  return slug in legacyPages ? (slug as LegacyPageKey) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const key = routeKey(slug);
  if (!key) return {};
  return metadataForPage(key);
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const key = routeKey(slug);
  if (!key) notFound();
  return <LegacyPage pageKey={key} />;
}
