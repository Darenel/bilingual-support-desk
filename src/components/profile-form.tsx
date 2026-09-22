"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/preferences";

type Profile = { first_name: string; last_name: string; username: string | null; email: string; role: string; locked: boolean };

export function ProfileForm() {
  const { t } = useLocale();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/profile", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || t("profile.loadFailed"));
        setProfile(result.profile);
      })
      .catch((cause) => {
        if (cause instanceof Error && cause.name !== "AbortError") setError(cause.message || t("profile.loadFailed"));
      });
    return () => controller.abort();
  }, [t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const changingCredentials = Boolean(data.password || data.email !== profile?.email || data.username !== (profile?.username ?? ""));
    if (changingCredentials && !data.current_password) {
      setError(t("profile.currentPasswordRequired"));
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t("profile.saveFailed"));
      setProfile(result.profile);
      form.reset();
      setSuccess(t("profile.saved"));
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("profile.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return error ? <p className="notice error" role="alert">{error}</p> : <p className="muted">{t("profile.loading")}</p>;
  return (
    <>
      <header className="page-head"><div><p className="eyebrow">{t("profile.eyebrow")}</p><h1>{t("profile.title")}</h1><p>{t("profile.intro")}</p></div></header>
      <form key={`${profile.first_name}:${profile.last_name}:${profile.username ?? ""}:${profile.email}`} className="form-stack card profile-form" onSubmit={submit}>
      {profile.locked && <p className="notice" role="status">{t("profile.locked")}</p>}
      <div className="two">
        <label>{t("profile.firstName")}<input name="first_name" defaultValue={profile.first_name} required maxLength={100} autoComplete="given-name" disabled={profile.locked} /></label>
        <label>{t("profile.lastName")}<input name="last_name" defaultValue={profile.last_name} maxLength={100} autoComplete="family-name" disabled={profile.locked} /></label>
      </div>
      <label>{t("profile.username")}<input name="username" defaultValue={profile.username ?? ""} minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]+" autoComplete="username" disabled={profile.locked} /><small>{t("profile.usernameHelp")}</small></label>
      <label>{t("profile.email")}<input name="email" type="email" defaultValue={profile.email} required autoComplete="email" disabled={profile.locked} /></label>
      <fieldset className="profile-password">
        <legend>{t("profile.passwordSection")}</legend>
        <p className="muted">{t("profile.passwordHelp")}</p>
        <label>{t("profile.currentPassword")}<input name="current_password" type="password" minLength={10} maxLength={128} autoComplete="current-password" disabled={profile.locked} /></label>
        <div className="two">
          <label>{t("profile.newPassword")}<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" disabled={profile.locked} /></label>
          <label>{t("profile.confirmPassword")}<input name="confirm_password" type="password" minLength={10} maxLength={128} autoComplete="new-password" disabled={profile.locked} /></label>
        </div>
      </fieldset>
      {error && <p className="notice error" role="alert">{error}</p>}
      {success && <p className="notice success" role="status">{success}</p>}
      <button className="button" disabled={busy || profile.locked}>{busy ? t("form.saving") : t("profile.save")}</button>
    </form></>
  );
}
