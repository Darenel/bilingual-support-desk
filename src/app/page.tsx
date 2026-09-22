import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";
import { PreferenceControls } from "@/components/preferences";

export default async function Home() {
  if (await currentUser()) redirect("/dashboard");
  const locale = await getLocale();
  const es = locale === "es";
  return (
    <main className="landing">
      <nav className="public-nav">
        <Link className="brand" href="/">
          Support Desk
        </Link>
        <div>
          <Link href="/demo">{es ? "Ver demo" : "View demo"}</Link>
          <PreferenceControls />
          <Link className="button small" href="/login">
            {es ? "Entrar" : "Sign in"}
          </Link>
        </div>
      </nav>
      <section className="hero">
        <p className="eyebrow">{es ? "SOPORTE QUE HABLA CLARO" : "SUPPORT THAT SPEAKS CLEARLY"}</p>
        <h1>{es ? "Tu equipo, cerca de cada conversación." : "Your team, close to every conversation."}</h1>
        <p className="lead">
          {es ? "Una mesa de ayuda bilingüe para responder con contexto, mantener el ritmo y cuidar a tus clientes." : "A bilingual support desk for answering with context, keeping the pace, and caring for your customers."}
        </p>
        <div className="actions">
          <Link className="button" href="/login?mode=register">
            {es ? "Crear mi espacio" : "Create my workspace"}
          </Link>
          <Link className="text-link" href="/demo">
            {es ? "Probar el widget →" : "Try the widget →"}
          </Link>
        </div>
      </section>
      <section className="feature-grid">
        <article>
          <b>ES / EN</b>
          <h2>{es ? "Dos idiomas, una vista" : "Two languages, one view"}</h2>
          <p>{es ? "Identifica el idioma de cada cliente y mantén el contexto de la conversación." : "Identify each customer’s language and keep the conversation in context."}</p>
        </article>
        <article>
          <b>PRIORIDAD</b>
          <h2>{es ? "Lo urgente a la vista" : "Urgent work in view"}</h2>
          <p>{es ? "Ordena solicitudes, asigna responsables y no pierdas un caso importante." : "Sort requests, assign owners, and do not lose an important case."}</p>
        </article>
        <article>
          <b>PYTHON</b>
          <h2>{es ? "Una segunda lectura" : "A second look"}</h2>
          <p>{es ? "Pide un análisis breve cuando necesites clasificar y resumir un ticket." : "Request a quick analysis when you need to classify and summarize a ticket."}</p>
        </article>
      </section>
    </main>
  );
}
