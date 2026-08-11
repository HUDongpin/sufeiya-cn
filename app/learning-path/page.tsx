import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("learning-path");

export default function Page() {
  return <RoutedLegacyPage pageKey="learning-path" />;
}
