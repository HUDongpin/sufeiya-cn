import { PublicLegacyPage } from "@/components/public-legacy-page";
import { PublicReadingP0DataControls } from "@/components/public-learning/public-reading-p0-data-controls";
import { metadataForPage } from "@/lib/site";

export const metadata = {
  ...metadataForPage("my-data"),
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <PublicLegacyPage
      pageKey="my-data"
      afterLegacyContent={<PublicReadingP0DataControls />}
    />
  );
}
