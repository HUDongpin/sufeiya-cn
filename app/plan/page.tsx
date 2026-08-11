import { RoutedLegacyPage, metadataForRoutedPage } from "@/components/routed-legacy-page";

export const metadata = metadataForRoutedPage("plan");

export default function Page() {
  return <RoutedLegacyPage pageKey="plan" />;
}
