"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "@/lib/types";
import { LiveUpdates } from "@/components/live-updates";
import { PreferenceControls, useLocale } from "@/components/preferences";
export function Shell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const path = usePathname(),
    router = useRouter(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    { t } = useLocale();
  const links = [
    ["/dashboard", "nav.dashboard", "overview"],
    ["/dashboard/tickets", "nav.tickets", "tickets"],
    ["/dashboard/team", "nav.team", "team"],
    ["/dashboard/settings", "nav.settings", "settings"],
  ];
  const icon = (name: string) => <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d={name === "overview" ? "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" : name === "tickets" ? "M5 5h14v10H9l-4 4zM8 9h8M8 12h5" : name === "team" ? "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m5 1a3 3 0 0 1 3 3v1m-1-11a3 3 0 0 1 0 6" : "M12 3v2m0 14v2m6.4-15.4-1.4 1.4M7 17l-1.4 1.4M21 12h-2M5 12H3m15.4 6.4-1.4-1.4M7 7 5.6 5.6M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6"} /></svg>;
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) throw new Error();
      router.replace("/");
      router.refresh();
    } catch {
      setError(t("form.tryAgain"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          Support Desk
        </Link>
        <p className="org">{user.org_name}</p>
        <LiveUpdates />
        <nav>
          {links
            .filter(
              ([href]) =>
                (!["/dashboard/team", "/dashboard/settings"].includes(href)) ||
                user.role === "admin",
            )
            .map(([href, label, iconName]) => {
              const active =
                href === "/dashboard" ? path === href : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={active ? "active" : ""}
                  aria-current={active ? "page" : undefined}
                >
                  {icon(iconName)}
                  {t(label)}
                </Link>
              );
            })}
          <Link href="/dashboard/profile" className={path === "/dashboard/profile" ? "active" : ""} aria-current={path === "/dashboard/profile" ? "page" : undefined}>
            <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" focusable="false"><path fill="currentColor" d="M19.14 12.94a7.7 7.7 0 0 0 .05-.94 7.7 7.7 0 0 0-.05-.94l2.03-1.58-2-3.46-2.39.96a7.1 7.1 0 0 0-1.63-.94L14.79 3h-4l-.36 2.3a7.1 7.1 0 0 0-1.63.94l-2.39-.96-2 3.46 2.03 1.58A7.7 7.7 0 0 0 6.39 12c0 .32.02.63.05.94l-2.03 1.58 2 3.46 2.39-.96c.5.39 1.05.71 1.63.94l.36 2.3h4l.36-2.3c.58-.23 1.13-.55 1.63-.94l2.39.96 2-3.46-2.03-1.58ZM12.79 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" /></svg>
            {t("nav.profile")}
          </Link>
        </nav>
        <div className="sidebar-preferences">
          <PreferenceControls />
        </div>
        <div className="user-card">
          <b>{user.name}</b>
          <span>{t(user.role === "admin" ? "role.admin" : "role.agent")}</span>
          <button onClick={logout} disabled={busy}>
            {t("shell.signOut")}
          </button>
          {error && (
            <p className="logout-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
