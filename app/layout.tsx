import { ClerkProvider } from "@clerk/nextjs";
import { zhCN } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "../styles.css";
import "./next-overrides.css";

import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  icons: {
    icon: [{ url: "/assets/sufeiya-mark.png", type: "image/png" }],
    apple: [{ url: "/assets/sufeiya-mark.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f5ed",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <ClerkProvider localization={zhCN}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
