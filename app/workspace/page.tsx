import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("workspace");

export default function Page() {
  return <RoutedLegacyPage pageKey="workspace" />;
}
