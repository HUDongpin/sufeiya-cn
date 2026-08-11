import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("review");

export default function Page() {
  return <RoutedLegacyPage pageKey="review" />;
}
