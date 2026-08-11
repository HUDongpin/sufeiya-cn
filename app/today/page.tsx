import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("today");

export default function Page() {
  return <RoutedLegacyPage pageKey="today" />;
}
