import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("focus");

export default function Page() {
  return <RoutedLegacyPage pageKey="focus" />;
}
