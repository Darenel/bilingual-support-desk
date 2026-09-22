import { currentUser, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { SettingsForm } from "@/components/forms";
import { getLocale } from "@/lib/i18n-server";
export default async function Settings() {
  const user = await currentUser();
  if (!user) return null;
  requireAdmin(user);
  const es = (await getLocale()) === "es";
  const org = db()
    .prepare(
      "SELECT name,widget_key,allowed_origin FROM organizations WHERE id=?",
    )
    .get(user.org_id) as {
    name: string;
    widget_key: string;
    allowed_origin: string;
  };
  const snippet = `<script src="${process.env.APP_ORIGIN || "http://localhost:3000"}/widget.js" data-key="${org.widget_key}"></script>`;
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{es ? "CONFIGURACIÓN" : "SETTINGS"}</p>
          <h1>{es ? "Tu espacio" : "Your workspace"}</h1>
          <p>{es ? "Define de dónde pueden llegar las conversaciones del widget." : "Set where widget conversations can come from."}</p>
        </div>
      </header>
      <div className="split">
        <SettingsForm name={org.name} origin={org.allowed_origin} />
        <section className="card">
          <h2>{es ? "Instala el widget" : "Install the widget"}</h2>
          <p className="muted">
            {es ? "Copia este fragmento antes de cerrar el cuerpo de tu sitio." : "Copy this snippet before the closing body tag of your site."}
          </p>
          <pre>
            <code>{snippet}</code>
          </pre>
          <p className="muted">
            {es ? "Permite al navegador cargar respuestas del widget desde este origen." : "This lets the browser load widget responses from this origin."}
          </p>
        </section>
      </div>
    </>
  );
}
