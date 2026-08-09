import { ClerkProvider } from "@clerk/nextjs";
import { zhCN } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "../styles.css";
import "./next-overrides.css";

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
  return (
    <html lang="zh-CN">
      <body>
        <ClerkProvider localization={clerkLocalization}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
