import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("diagnostic");

export default function Page() {
  return <RoutedLegacyPage pageKey="diagnostic" />;
}
