import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("practice-writing");

export default function Page() {
  return <RoutedLegacyPage pageKey="practice-writing" />;
}
