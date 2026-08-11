import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("recommendations");

export default function Page() {
  return <RoutedLegacyPage pageKey="recommendations" />;
}
