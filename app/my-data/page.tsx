import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("my-data");

export default function Page() {
  return <RoutedLegacyPage pageKey="my-data" />;
}
