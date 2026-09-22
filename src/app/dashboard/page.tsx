import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { metrics, presentTicket } from "@/lib/tickets";
import { OperationalMetrics } from "@/components/operational-metrics";
import { SlaStatus } from "@/components/sla-status";
import type { Ticket } from "@/lib/types";
import { formatDate, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
export default async function Dashboard() {
  const user = await currentUser();
  if (!user) return null;
  const locale = await getLocale();
  const es = locale === "es";
  const tickets = db()
    .prepare(
      "SELECT * FROM tickets WHERE org_id=? ORDER BY updated_at DESC LIMIT 5",
    )
    .all(user.org_id) as Ticket[];
  const counts = db()
    .prepare(
      "SELECT status, count(*) AS total FROM tickets WHERE org_id=? GROUP BY status",
    )
    .all(user.org_id) as { status: string; total: number }[];
  const total = (status: string) =>
    counts.find((c) => c.status === status)?.total || 0;
  const operationalMetrics = metrics(user.org_id);
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{es ? "PANEL" : "DASHBOARD"}</p>
          <h1>{es ? "Hola" : "Hello"}, {user.name.split(" ")[0]}.</h1>
          <p>{es ? `Esto es lo que necesita atención en ${user.org_name}.` : `Here is what needs attention at ${user.org_name}.`}</p>
        </div>
        <Link className="button" href="/dashboard/tickets/new">
          {es ? "Nuevo ticket" : "New ticket"}
        </Link>
      </header>
      <section className="stats dashboard-status">
        <article className="open">
          <span>{es ? "Abiertos" : "Open"}</span>
          <b>{total("open")}</b>
          <small>{es ? "requieren atención" : "need attention"}</small>
        </article>
        <article className="pending">
          <span>{es ? "En espera" : "Pending"}</span>
          <b>{total("pending")}</b>
          <small>{es ? "esperan respuesta" : "awaiting a reply"}</small>
        </article>
        <article className="closed">
          <span>{es ? "Cerrados" : "Closed"}</span>
          <b>{total("closed")}</b>
          <small>{es ? "resueltos" : "resolved"}</small>
        </article>
      </section>
      <div className="dashboard-main">
        <OperationalMetrics data={operationalMetrics} />
        <section className="recent-activity">
          <section className="section-head">
            <div>
              <h2>{es ? "Actividad reciente" : "Recent activity"}</h2>
              <p>{es ? "Los últimos tickets actualizados." : "The most recently updated tickets."}</p>
            </div>
            <Link href="/dashboard/tickets">{es ? "Ver todos →" : "View all →"}</Link>
          </section>
          <TicketRows tickets={tickets} locale={locale} />
        </section>
      </div>
    </>
  );
}
export function TicketRows({ tickets, locale = "en" }: { tickets: Ticket[]; locale?: Locale }) {
  const es = locale === "es";
  if (!tickets.length)
    return (
      <div className="empty">
        {es ? "Aún no hay tickets. Crea el primero cuando llegue una consulta." : "There are no tickets yet. Create the first one when a request arrives."}
      </div>
    );
  const displayTickets = tickets.map((ticket) => presentTicket(ticket));
  return (
    <div className="ticket-list">
      {displayTickets.map((ticket) => (
        <Link
          href={"/dashboard/tickets/" + ticket.id}
          key={ticket.id}
          className="ticket-row"
        >
          <span className={"dot " + ticket.status} />
          <div>
            <b>{ticket.subject}</b>
            <p>
              {ticket.customer} ·{" "}
              {ticket.language === "es" ? "Español" : "English"}
            </p>
          </div>
          <span className={"badge " + ticket.priority}>
            {ticket.priority === "high" ? (es ? "Alta" : "High") : (es ? "Normal" : "Normal")}
          </span>
          <SlaStatus ticket={ticket} compact initialNow={new Date().getTime()} />
          <time>
            {formatDate(locale, ticket.updated_at, { dateStyle: "medium" })}
          </time>
        </Link>
      ))}
    </div>
  );
}
