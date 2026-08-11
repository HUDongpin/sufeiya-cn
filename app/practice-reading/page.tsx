import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("practice-reading");

export default function Page() {
  return <RoutedLegacyPage pageKey="practice-reading" />;
}
