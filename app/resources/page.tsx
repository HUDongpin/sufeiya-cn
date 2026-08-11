import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("resources");

export default function Page() {
  return <RoutedLegacyPage pageKey="resources" />;
}
