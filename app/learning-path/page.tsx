import { PublicLegacyPage } from "@/components/public-legacy-page";
import { metadataForPage } from "@/lib/site";

export const metadata = metadataForPage("learning-path");

export default function Page() {
  return <PublicLegacyPage pageKey="learning-path" />;
}
