"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/preferences";

async function send(url: string, data: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const error = Object.assign(
      new Error(result.error || "Could not complete the request."),
      { status: response.status },
    );
    throw error;
  }
  return result;
}
function Submit({ children, pending }: { children: string; pending: boolean }) {
  const { t } = useLocale();
  return (
    <button className="button" disabled={pending}>
      {pending ? t("form.saving") : children}
    </button>
  );
}

export function AuthForm({ register }: { register: boolean }) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    { t } = useLocale();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await send(
        "/api/auth",
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("form.tryAgain"));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack">
      <input
        type="hidden"
        name="action"
        value={register ? "register" : "login"}
      />
      {register && (
        <>
          <label>
            {t("form.yourName")}
            <input name="name" required maxLength={100} autoComplete="name" />
          </label>
          <label>
            {t("form.companyName")}
            <input name="company" required maxLength={100} />
          </label>
        </>
      )}
      <label>
        {t("form.workEmail")}
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label>
        {t("form.password")}
        <input
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete={register ? "new-password" : "current-password"}
        />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <Submit pending={pending}>{t(register ? "auth.createWorkspace" : "auth.signIn")}</Submit>
    </form>
  );
}
export function TicketForm() {
  const router = useRouter(),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    { t, locale } = useLocale();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const r = await send(
        "/api/tickets",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      router.push("/dashboard/tickets/" + r.id);
    } catch (x) {
      setError(x instanceof Error ? x.message : t("form.tryAgain"));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack card wide">
      <label>
        {t("ticket.subject")}
        <input
          name="subject"
          required
          maxLength={150}
          placeholder={t("ticket.subjectPlaceholder")}
        />
      </label>
      <div className="two">
        <label>
          {t("ticket.customerName")}
          <input name="customer" required maxLength={100} />
        </label>
        <label>
          {t("form.email")}
          <input name="email" type="email" required />
        </label>
      </div>
      <label>
        {t("ticket.language")}
        <select name="language" defaultValue={locale}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        {t("ticket.message")}
        <textarea name="body" required maxLength={4000} rows={7} />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <Submit pending={pending}>{t("ticket.create")}</Submit>
    </form>
  );
}
export function ReplyForm({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError("");
    try {
      await send("/api/tickets/" + id, {
        action: "reply",
        body: new FormData(form).get("body"),
      });
      setDraft("");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("form.tryAgain"));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="reply">
      <label className="sr-only" htmlFor="reply">
        {t("reply.label")}
      </label>
      <textarea
        id="reply"
        name="body"
        required
        maxLength={4000}
        rows={4}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("reply.placeholder")}
      />
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <Submit pending={pending}>{t("reply.send")}</Submit>
    </form>
  );
}
export function TicketControls({
  id,
  ticket,
  agents,
}: {
  id: string;
  ticket: {
    status: string;
    priority: string;
    assigned_to: string | null;
    version: number;
  };
  agents: { id: string; name: string }[];
}) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [conflict, setConflict] = useState(false),
    [dirty, setDirty] = useState(false),
    [seenVersion, setSeenVersion] = useState(ticket.version),
    [values, setValues] = useState({
      status: ticket.status,
      priority: ticket.priority,
      assigned_to: ticket.assigned_to || "",
    }),
    [analysis, setAnalysis] = useState<{
      category: string;
      language: string;
      summary: string;
      method: string;
    } | null>(null),
    [analysisError, setAnalysisError] = useState(""),
    { t } = useLocale();
  if (ticket.version > seenVersion && !dirty) {
    setValues({
      status: ticket.status,
      priority: ticket.priority,
      assigned_to: ticket.assigned_to || "",
    });
    setSeenVersion(ticket.version);
    setDirty(false);
  }
  const change = (name: "status" | "priority" | "assigned_to", value: string) => {
    setDirty(true);
    setValues((current) => ({ ...current, [name]: value }));
  };
  async function update(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    setConflict(false);
    try {
      await send("/api/tickets/" + id, {
        action: "update",
        ...values,
        expectedVersion: seenVersion,
      });
      setDirty(false);
      router.refresh();
    } catch (x) {
      if (typeof x === "object" && x && "status" in x && x.status === 409) {
        setConflict(true);
        setError(t("ticket.conflict"));
      } else setError(x instanceof Error ? x.message : t("form.tryAgain"));
    } finally {
      setPending(false);
    }
  }
  async function analyze() {
    setPending(true);
    setAnalysisError("");
    try {
      setAnalysis(await send("/api/tickets/" + id, { action: "analyze" }));
    } catch (x) {
      setAnalysisError(x instanceof Error ? x.message : t("form.tryAgain"));
    } finally {
      setPending(false);
    }
  }
  return (
    <aside className="controls">
      <form onSubmit={update} className="form-stack">
        <label>
          {t("ticket.status")}
          <select name="status" value={values.status} onChange={(event) => change("status", event.target.value)}>
            <option value="open">{t("status.open")}</option>
            <option value="pending">{t("status.pending")}</option>
            <option value="closed">{t("status.closed")}</option>
          </select>
        </label>
        <label>
          {t("ticket.priority")}
          <select name="priority" value={values.priority} onChange={(event) => change("priority", event.target.value)}>
            <option value="normal">{t("priority.normal")}</option>
            <option value="high">{t("priority.high")}</option>
          </select>
        </label>
        <label>
          {t("ticket.assignee")}
          <select name="assigned_to" value={values.assigned_to} onChange={(event) => change("assigned_to", event.target.value)}>
            <option value="">{t("ticket.unassigned")}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {conflict && (
          <button
            className="quiet-button"
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                const response = await fetch("/api/tickets/" + id, { cache: "no-store" });
                if (!response.ok) throw new Error(t("ticket.reloadFailed"));
                const latest = await response.json();
                setValues({
                  status: latest.ticket.status,
                  priority: latest.ticket.priority,
                  assigned_to: latest.ticket.assigned_to || "",
                });
                setSeenVersion(latest.ticket.version);
                setDirty(false);
                setConflict(false);
                router.refresh();
              } catch (error) {
                setError(error instanceof Error ? error.message : t("ticket.reloadFailed"));
              } finally {
                setPending(false);
              }
            }}
          >
            {t("ticket.reload")}
          </button>
        )}
        <Submit pending={pending}>{t("ticket.update")}</Submit>
      </form>
      <button className="quiet-button" onClick={analyze} disabled={pending}>
        {t("analysis.analyze")}
      </button>
      {analysis && (
          <div className="analysis">
            <b>{t(`analysis.category.${analysis.category}`)}</b>
            <p>{analysis.summary}</p>
            <small>{t(`analysis.language.${analysis.language}`)}</small>
        </div>
      )}
      {analysisError && <p className="notice error" role="alert">{analysisError}</p>}
    </aside>
  );
}
export function TeamForm() {
  const router = useRouter();
  const { t } = useLocale();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await send("/api/team", Object.fromEntries(new FormData(form)));
      form.reset();
      setSuccess(t("team.created"));
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : t("form.tryAgain"));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack card">
      <h2>{t("team.create")}</h2>
      <label>
        {t("form.name")}
        <input name="name" required maxLength={100} />
      </label>
      <label>
        {t("form.email")}
        <input name="email" type="email" required />
      </label>
      <label>
        {t("team.initialPassword")}
        <input name="password" type="password" minLength={10} required />
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="notice success" role="status">
          {success}
        </p>
      )}
      <Submit pending={pending}>{t("team.create")}</Submit>
    </form>
  );
}
export function SettingsForm({
  name,
  origin,
}: {
  name: string;
  origin: string;
}) {
  const router = useRouter(),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    { t } = useLocale();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      await send(
        "/api/settings",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      router.refresh();
    } catch (x) {
      setError(x instanceof Error ? x.message : t("form.tryAgain"));
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit} className="form-stack card">
      <label>
        {t("settings.organizationName")}
        <input name="name" defaultValue={name} required maxLength={100} />
      </label>
      <label>
        {t("settings.authorizedOrigin")}
        <input
          name="origin"
          type="url"
          defaultValue={origin}
          required
          maxLength={250}
        />
        <small>{t("settings.originHelp")}</small>
      </label>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <Submit pending={pending}>{t("settings.save")}</Submit>
    </form>
  );
}
