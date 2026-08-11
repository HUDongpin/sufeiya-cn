import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("retest");

export default function Page() {
  return <RoutedLegacyPage pageKey="retest" />;
}
