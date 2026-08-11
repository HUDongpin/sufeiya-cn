import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("about");

export default function Page() {
  return <RoutedLegacyPage pageKey="about" />;
}
