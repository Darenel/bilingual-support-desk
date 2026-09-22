"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/preferences";

export function LiveUpdates() {
  const router = useRouter();
  const { t } = useLocale();
  const [connected, setConnected] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const retryRef = useRef<() => void>(() => {});

  useEffect(() => {
    let source: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    let wasConnected = false;
    let stopped = false;
    let revision = 0;
    const connect = () => {
      if (stopped || document.hidden || attempts >= 5) {
        if (attempts >= 5) setExhausted(true);
        return;
      }
      source = new EventSource("/api/events");
      source.addEventListener("open", () => {
        if (wasConnected) router.refresh();
        wasConnected = true;
        attempts = 0;
        setExhausted(false);
        setConnected(true);
      });
      source.addEventListener("change", (event) => {
        let next = 0;
        try {
          next = Number(JSON.parse((event as MessageEvent).data).revision);
        } catch {
          return;
        }
        if (!Number.isFinite(next) || next <= revision) return;
        revision = next;
        window.dispatchEvent(new Event("support-change"));
        router.refresh();
      });
      source.addEventListener("error", () => {
        source?.close();
        source = undefined;
        setConnected(false);
        attempts += 1;
        retry = setTimeout(connect, Math.min(1000 * 2 ** attempts, 15000));
      });
    };
    const visible = () => {
      if (document.hidden) {
        source?.close();
        source = undefined;
        if (retry) clearTimeout(retry);
        setConnected(false);
      } else if (!source) connect();
    };
    retryRef.current = () => {
      attempts = 0;
      setExhausted(false);
      connect();
    };
    document.addEventListener("visibilitychange", visible);
    connect();
    return () => {
      stopped = true;
      source?.close();
      if (retry) clearTimeout(retry);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [router]);

  return (
    <div className="connection" role="status" aria-live="polite">
      <span className={connected ? "connection-dot" : "connection-dot offline"} />
      {connected ? t("updates.live") : t("updates.paused")}
      {exhausted && <button type="button" onClick={() => retryRef.current()}>{t("updates.reconnect")}</button>}
    </div>
  );
}
