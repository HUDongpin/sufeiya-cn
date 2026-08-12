"use client";

import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { SofiaFloatingAssistant } from "@/components/sofia-floating-assistant";
import {
  SofiaPublicFloatingAssistant,
  SofiaPublicPage,
} from "@/components/sofia-public-access";
import { SuperTeacherSessionProvider } from "@/components/super-teacher/super-teacher-session-provider";
import type { SofiaSurface } from "@/components/site-shell";
import type { SufeiyaBetaAccessContext } from "@/lib/auth/beta-access";

export function SofiaAccessBoundary({
  surface,
  betaAccessContext,
  children,
}: {
  surface: Exclude<SofiaSurface, "none">;
  betaAccessContext: SufeiyaBetaAccessContext;
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const accessState = !isLoaded
    ? "loading" as const
    : !isSignedIn
      ? "signed-out" as const
      : betaAccessContext === "invitation_required"
        ? "invitation-required" as const
        : "unavailable" as const;
  const interactiveAccess = isLoaded && isSignedIn && betaAccessContext === "approved";

  if (surface === "page") {
    if (!interactiveAccess) return <SofiaPublicPage accessState={accessState} />;
    return <SuperTeacherSessionProvider>{children}</SuperTeacherSessionProvider>;
  }

  return (
    <>
      {children}
      {interactiveAccess ? (
        <SuperTeacherSessionProvider>
          <SofiaFloatingAssistant />
        </SuperTeacherSessionProvider>
      ) : (
        <SofiaPublicFloatingAssistant accessState={accessState} />
      )}
    </>
  );
}

export function SofiaUnavailableBoundary({
  surface,
  children,
}: {
  surface: Exclude<SofiaSurface, "none">;
  children: ReactNode;
}) {
  if (surface === "page") return <SofiaPublicPage accessState="unavailable" />;
  return (
    <>
      {children}
      <SofiaPublicFloatingAssistant accessState="unavailable" />
    </>
  );
}
