"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/preferences";

export function DemoReset() {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function reset() {
    if (!window.confirm(t("demo.confirm"))) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("demo.failed"));
      setMessage(t("demo.complete", result));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("demo.failed"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="demo-reset">
      <h2>{t("demo.title")}</h2>
      <p>{t("demo.description")}</p>
      <button className="quiet-button" type="button" disabled={busy} onClick={reset}>
        {t(busy ? "demo.resetting" : "demo.reset")}
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
