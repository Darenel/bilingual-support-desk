import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { WidgetDemo } from "@/components/widget-demo";
import { DemoReset } from "@/components/demo-reset";
import { getLocale } from "@/lib/i18n-server";
import { PreferenceControls } from "@/components/preferences";

type Organization = { widget_key: string; allowed_origin: string };

export default async function Demo() {
  const user = await currentUser();
  const es = (await getLocale()) === "es";
  const organization = user
    ? (db()
        .prepare(
          "SELECT widget_key, allowed_origin FROM organizations WHERE id=?",
        )
        .get(user.org_id) as Organization)
    : null;

  return (
    <main className="demo">
      <nav className="public-nav">
        <Link className="brand" href="/">
          Support Desk
        </Link>
        <div>
          <PreferenceControls />
          {user ? (
            <Link className="button small" href="/dashboard">
              {es ? "Ir al panel" : "Go to dashboard"}
            </Link>
          ) : (
            <Link className="button small" href="/login">
              {es ? "Entrar" : "Sign in"}
            </Link>
          )}
        </div>
      </nav>
      <section>
        <p className="eyebrow">{es ? "DEMO DEL WIDGET" : "WIDGET DEMO"}</p>
        <h1>{es ? "Una conversación empieza aquí." : "A conversation starts here."}</h1>
        <p className="lead">
          {es ? "Esta página funciona como un sitio anfitrión para probar el widget de tu organización." : "This page acts as a host site for testing your organization’s widget."}
        </p>
        <div className="demo-site">
          <b>Casa Lumen</b>
          <h2>{es ? "Objetos hechos para durar." : "Objects made to last."}</h2>
          <p>{es ? "Conoce nuestra colección de piezas para casa." : "Discover our collection of pieces for the home."}</p>
        </div>
        {organization ? (
          <p className="muted">
            {es ? "El widget activo usa la clave de tu organización. Para instalarlo en otro sitio, configura primero el origen autorizado:" : "The active widget uses your organization’s key. To install it on another site, first configure the allowed origin:"}{" "}
            {organization.allowed_origin}.
          </p>
        ) : (
          <p className="muted">
            {es ? "Inicia sesión para cargar el widget de tu organización y probar una conversación real." : "Sign in to load your organization’s widget and try a real conversation."}
          </p>
        )}
      </section>
      {organization && <WidgetDemo widgetKey={organization.widget_key} />}
      {process.env.DEMO_MODE === "true" &&
        user?.id === "recruiter-admin" &&
        user.org_id === "recruiter-demo" &&
        user.role === "admin" && <DemoReset />}
    </main>
  );
}
