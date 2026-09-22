import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Ticket } from "@/lib/types";
import { TicketRows } from "../page";
import { getLocale } from "@/lib/i18n-server";

export default async function Tickets({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await currentUser();
  if (!user) return null;
  const locale = await getLocale();
  const es = locale === "es";
  const filters = await searchParams;
  const q = filters.q?.trim() || "";
  const status = ["open", "pending", "closed"].includes(filters.status || "")
    ? filters.status
    : "";
  const clauses = ["org_id=?"];
  const args: string[] = [user.org_id];
  if (q) {
    clauses.push("(subject LIKE ? OR customer LIKE ? OR email LIKE ?)");
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status) {
    clauses.push("status=?");
    args.push(status);
  }
  const tickets = db()
    .prepare(
      `SELECT * FROM tickets WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC`,
    )
    .all(...args) as Ticket[];
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{es ? "BANDEJA" : "INBOX"}</p>
          <h1>Tickets</h1>
          <p>
            {es ? `${tickets.length} conversación${tickets.length === 1 ? "" : "es"} encontrada${tickets.length === 1 ? "" : "s"}.` : `${tickets.length} conversation${tickets.length === 1 ? "" : "s"} found.`}
          </p>
        </div>
        <Link className="button" href="/dashboard/tickets/new">
          {es ? "Nuevo ticket" : "New ticket"}
        </Link>
      </header>
      <form className="filters">
        <label className="sr-only" htmlFor="q">
          {es ? "Buscar" : "Search"}
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder={es ? "Buscar por asunto, cliente o correo" : "Search by subject, customer, or email"}
        />
        <label className="sr-only" htmlFor="status">
          {es ? "Filtrar por estado" : "Filter by status"}
        </label>
        <select id="status" name="status" defaultValue={status}>
          <option value="">{es ? "Todos los estados" : "All statuses"}</option>
          <option value="open">{es ? "Abiertos" : "Open"}</option>
          <option value="pending">{es ? "Pendientes" : "Pending"}</option>
          <option value="closed">{es ? "Cerrados" : "Closed"}</option>
        </select>
        <button className="quiet-button">{es ? "Filtrar" : "Filter"}</button>
        {(q || status) && (
          <Link className="text-link" href="/dashboard/tickets">
            {es ? "Limpiar filtros" : "Clear filters"}
          </Link>
        )}
      </form>
      <TicketRows tickets={tickets} locale={locale} />
    </>
  );
}
