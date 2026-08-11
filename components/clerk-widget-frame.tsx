"use client";

import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  SignIn,
  SignUp,
} from "@clerk/nextjs";

function ClerkConnectionPanel({ mode }: { mode: "loading" | "failed" }) {
  const failed = mode === "failed";

  return (
    <section
      className={`account-connection-card${failed ? " is-failed" : ""}`}
      role={failed ? "alert" : "status"}
      aria-live="polite"
      aria-labelledby={`clerk-${mode}-title`}
    >
      <span className="account-connection-indicator" aria-hidden="true" />
      <div>
        <p className="account-mode-kicker">CLERK · SECURE ACCOUNT ACCESS</p>
        <h2 id={`clerk-${mode}-title`}>
          {failed ? "安全登录暂时未能载入。" : "正在载入安全登录…"}
        </h2>
        <p>
          {failed
            ? "请检查网络后刷新本页。工作台仍保持关闭，本机学习记录没有被上传或改动。"
            : "正在连接账户服务。工作台在身份确认完成前保持关闭，本机学习记录不会因此上传。"}
        </p>
      </div>
    </section>
  );
}

export function ClerkWidgetFrame({ mode }: { mode: "sign-in" | "sign-up" }) {
  const loadingPanel = <ClerkConnectionPanel mode="loading" />;

  return (
    <div className="clerk-widget-frame">
      <ClerkLoading>{loadingPanel}</ClerkLoading>
      <ClerkFailed>
        <ClerkConnectionPanel mode="failed" />
      </ClerkFailed>
      <ClerkLoaded>
        {mode === "sign-in" ? (
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            fallbackRedirectUrl="/workspace"
            fallback={loadingPanel}
            appearance={{ elements: { rootBox: { width: "100%" } } }}
          />
        ) : (
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            fallbackRedirectUrl="/workspace"
            fallback={loadingPanel}
            appearance={{ elements: { rootBox: { width: "100%" } } }}
          />
        )}
      </ClerkLoaded>
    </div>
  );
}
