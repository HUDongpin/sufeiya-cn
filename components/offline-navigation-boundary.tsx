"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  shouldBlockOfflineNavigation,
  type OfflineNavigationCandidate,
} from "@/lib/offline-navigation";

import styles from "./offline-navigation-boundary.module.css";

type ConnectivityState = "online" | "offline" | "blocked" | "recovered";

const copy = {
  offline: {
    title: "当前离线",
    message: "已保存到本机的学习记录仍保留。请留在当前页，不要刷新或关闭；恢复网络后再进入其他页面。",
  },
  blocked: {
    title: "当前离线，未进入新页面",
    message: "本页仍然保留，已保存到本机的学习记录没有改变。请不要刷新或关闭；恢复网络后再试。",
  },
  recovered: {
    title: "已重新连接",
    message: "现在可以继续进入其他页面。",
  },
} satisfies Record<Exclude<ConnectivityState, "online">, Readonly<{ title: string; message: string }>>;

const RECOVERY_NOTICE_MS = 5_000;

function anchorCandidate(anchor: HTMLAnchorElement): OfflineNavigationCandidate {
  return {
    href: anchor.href,
    download: anchor.hasAttribute("download"),
    target: anchor.getAttribute("target") ?? "",
  };
}

export function OfflineNavigationBoundary() {
  const [state, setState] = useState<ConnectivityState>("online");
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineRef = useRef(false);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current !== null) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const showOffline = useCallback(() => {
    clearRecoveryTimer();
    wasOfflineRef.current = true;
    setState("offline");
  }, [clearRecoveryTimer]);

  const showRecovered = useCallback(() => {
    clearRecoveryTimer();
    if (!wasOfflineRef.current) {
      setState("online");
      return;
    }
    wasOfflineRef.current = false;
    setState("recovered");
    recoveryTimerRef.current = setTimeout(() => {
      setState("online");
      recoveryTimerRef.current = null;
    }, RECOVERY_NOTICE_MS);
  }, [clearRecoveryTimer]);

  useEffect(() => {
    const synchronizeConnectivity = () => {
      if (navigator.onLine) showRecovered();
      else showOffline();
    };

    const handleOfflineNavigation = (event: MouseEvent) => {
      const target = event.target;
      const anchor = target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!shouldBlockOfflineNavigation({
        online: navigator.onLine,
        activation: event,
        candidate: anchor ? anchorCandidate(anchor) : null,
        currentHref: window.location.href,
      })) {
        return;
      }

      event.preventDefault();
      wasOfflineRef.current = true;
      setState("blocked");
    };

    window.addEventListener("offline", showOffline);
    window.addEventListener("online", showRecovered);
    window.addEventListener("pageshow", synchronizeConnectivity);
    window.addEventListener("click", handleOfflineNavigation, true);
    const initialSynchronizationFrame = window.requestAnimationFrame(synchronizeConnectivity);

    return () => {
      window.cancelAnimationFrame(initialSynchronizationFrame);
      clearRecoveryTimer();
      window.removeEventListener("offline", showOffline);
      window.removeEventListener("online", showRecovered);
      window.removeEventListener("pageshow", synchronizeConnectivity);
      window.removeEventListener("click", handleOfflineNavigation, true);
    };
  }, [clearRecoveryTimer, showOffline, showRecovered]);

  const visible = state !== "online";
  const content = visible ? copy[state] : copy.offline;

  return (
    <div
      className={styles.notice}
      data-offline-navigation-notice
      data-state={state}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      hidden={!visible}
    >
      <div className={styles.noticeInner}>
        <strong>{content.title}</strong>
        <span>{content.message}</span>
      </div>
    </div>
  );
}
