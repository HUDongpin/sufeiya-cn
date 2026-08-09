import { LegacyPage } from "@/components/legacy-page";
import { metadataForPage } from "@/lib/site";

export const metadata = metadataForPage("home");

export default function HomePage() {
  return <LegacyPage pageKey="home" />;
}
