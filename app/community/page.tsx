import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("community");

export default function Page() {
  return <RoutedLegacyPage pageKey="community" />;
}
