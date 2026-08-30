import { PublicLegacyPage } from "@/components/public-legacy-page";
import { metadataForPage } from "@/lib/site";

export const metadata = metadataForPage("about");

export default function Page() {
  return <PublicLegacyPage pageKey="about" />;
}
