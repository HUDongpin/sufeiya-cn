import { PublicLegacyPage } from "@/components/public-legacy-page";
import { metadataForPage } from "@/lib/site";

export const metadata = metadataForPage("home");

export default function HomePage() {
  return <PublicLegacyPage pageKey="home" />;
}
