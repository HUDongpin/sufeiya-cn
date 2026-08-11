import { zhCN } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import "../styles.css";
import "./next-overrides.css";

import { getClerkRuntimeState } from "@/lib/auth/clerk-config";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const clerkLocalization = {
  ...zhCN,
  // These two strings are currently undefined in Clerk's zh-CN bundle and
  // otherwise fall back to English in the sign-in and sign-up cards.
  formFieldInputPlaceholder__password: "请输入密码",
  formFieldInputPlaceholder__signUpPassword: "请创建密码",
};

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
        <Script
          id="sufeiya-learning-events-runtime"
          src="/learning-events.js"
          strategy="beforeInteractive"
        />
        {clerkState.configured ? (
          <ClerkProvider
            dynamic
            localization={clerkLocalization}
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
