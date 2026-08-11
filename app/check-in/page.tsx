import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("check-in");

export default function Page() {
  return <RoutedLegacyPage pageKey="check-in" />;
}
