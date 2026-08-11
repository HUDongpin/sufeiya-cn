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

export function SofiaAccessBoundary({
  surface,
  children,
}: {
  surface: Exclude<SofiaSurface, "none">;
  children: ReactNode;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const accessState = isLoaded ? "signed-out" as const : "loading" as const;

  if (surface === "page") {
    if (!isLoaded || !isSignedIn) return <SofiaPublicPage accessState={accessState} />;
    return <SuperTeacherSessionProvider>{children}</SuperTeacherSessionProvider>;
  }

  return (
    <>
      {children}
      {isLoaded && isSignedIn ? (
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
