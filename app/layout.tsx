import { zhCN } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "../styles.css";
import "./next-overrides.css";

import { getClerkRuntimeState } from "@/lib/auth/clerk-config";
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
  const clerkState = getClerkRuntimeState();

  return (
    <html lang="zh-CN">
      <body>
        {clerkState.configured ? (
          <ClerkProvider
            dynamic
            localization={zhCN}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
          >
            {children}
          </ClerkProvider>
        ) : children}
      </body>
    </html>
  );
}
