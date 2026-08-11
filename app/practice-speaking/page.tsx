import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("practice-speaking");

export default function Page() {
  return <RoutedLegacyPage pageKey="practice-speaking" />;
}
