import { PublicLegacyPage } from "@/components/public-legacy-page";
import { metadataForPage } from "@/lib/site";

export const metadata = metadataForPage("platform");

export default function Page() {
  return <PublicLegacyPage pageKey="platform" />;
}
