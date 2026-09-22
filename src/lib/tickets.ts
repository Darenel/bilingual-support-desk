import { randomUUID } from "node:crypto";
import { db, transaction } from "./db";
import { plainRecord } from "./plain.mjs";
import { email, HttpError, text } from "./security";
import type { Event, Message, Ticket } from "./types";

const nowSql = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";
export const slaHours = (priority: Ticket["priority"]) => priority === "high" ? 1 : 4;
export function presentTicket(ticket: Ticket) {
  const hours = ticket.first_response_sla_hours ?? slaHours(ticket.priority);
  const safe = { ...ticket } as Ticket & { access_hash?: string };
  delete safe.access_hash;
  return {
    ...plainRecord(safe),
    first_response_due_at: new Date(new Date(ticket.created_at).getTime() + hours * 3_600_000).toISOString(),
    resolved_at: ticket.closed_at,
  };
}
export function changeMarker(org: string) {
  const row = db().prepare(`SELECT COALESCE(r.revision,0) AS revision,
    COALESCE((SELECT MAX(e.id) FROM events e JOIN tickets t ON t.id=e.ticket_id WHERE t.org_id=?),0) AS eventId,
    (SELECT count(*) FROM tickets WHERE org_id=?) AS ticketCount
    FROM organizations o LEFT JOIN org_revisions r ON r.org_id=o.id WHERE o.id=?`).get(org, org, org) as { revision: number; eventId: number; ticketCount: number };
  return plainRecord(row);
}
function changed(org: string) {
  db().prepare("INSERT INTO org_revisions(org_id,revision) VALUES (?,1) ON CONFLICT(org_id) DO UPDATE SET revision=revision+1").run(org);
}

export function getTicket(org: string, id: string) {
  const row = db()
    .prepare(
      "SELECT * FROM tickets WHERE id=? AND org_id=?",
    )
    .get(id, org) as Ticket | undefined;
  if (!row) throw new HttpError(404, "ticket_not_found");
  return presentTicket(row);
}
export function messages(id: string) {
  return db()
    .prepare(
      "SELECT * FROM messages WHERE ticket_id=? ORDER BY created_at,rowid",
    )
    .all(id) as Message[];
}
export function publicTicket(org: string, accessHash: string) {
  const ticket = db()
    .prepare(
      `SELECT id,subject,customer,language,status,version,created_at,updated_at
    FROM tickets WHERE org_id=? AND access_hash=?`,
    )
    .get(org, accessHash) as
    | Pick<
        Ticket,
        | "id"
        | "subject"
        | "customer"
        | "language"
        | "status"
        | "version"
        | "created_at"
        | "updated_at"
      >
    | undefined;
  if (!ticket) throw new HttpError(404, "conversation_not_found");
  return ticket;
}
export function publicMessages(id: string) {
  return db()
    .prepare(
      "SELECT id,author,kind,body,created_at FROM messages WHERE ticket_id=? ORDER BY created_at,rowid",
    )
    .all(id) as Omit<Message, "ticket_id">[];
}
export function history(id: string) {
  return db()
    .prepare("SELECT * FROM events WHERE ticket_id=? ORDER BY id DESC")
    .all(id) as Event[];
}
export function audit(id: string, actor: string, action: string) {
  db()
    .prepare("INSERT INTO events(ticket_id,actor,action) VALUES (?,?,?)")
    .run(id, actor, action);
}
export function createTicket(
  org: string,
  data: Record<string, unknown>,
  actor: string,
  accessHash: string | null = null,
) {
  const subject = text(data, "subject", 150);
  const customer = text(data, "customer", 100);
  const address = email(data);
  const body = text(data, "body", 4000);
  const language = text(data, "language", 2);
  if (!["es", "en"].includes(language))
    throw new HttpError(400, "invalid_language");
  return transaction(() => {
    const id = randomUUID();
    db()
      .prepare(
        "INSERT INTO tickets(id,org_id,subject,customer,email,language,access_hash) VALUES (?,?,?,?,?,?,?)",
      )
      .run(id, org, subject, customer, address, language, accessHash);
    db()
      .prepare(
        "INSERT INTO messages(id,ticket_id,author,kind,body) VALUES (?,?,?,?,?)",
      )
      .run(randomUUID(), id, customer, "customer", body);
    audit(id, actor, "Ticket creado");
    changed(org);
    return id;
  });
}
export function reply(
  org: string,
  id: string,
  author: string,
  body: string,
  kind: "customer" | "agent",
) {
  return transaction(() => {
    const ticket = getTicket(org, id);
    if (ticket.status === "closed")
      throw new HttpError(409, "ticket_closed");
    db()
      .prepare(
        "INSERT INTO messages(id,ticket_id,author,kind,body) VALUES (?,?,?,?,?)",
      )
      .run(randomUUID(), id, author, kind, body);
    db().prepare(`UPDATE tickets SET updated_at=${nowSql}, version=version+1,
      first_response_at=CASE WHEN ?='agent' THEN COALESCE(first_response_at,${nowSql}) ELSE first_response_at END,
      first_response_sla_hours=CASE WHEN ?='agent' AND first_response_at IS NULL THEN CASE priority WHEN 'high' THEN 1 ELSE 4 END ELSE first_response_sla_hours END
      WHERE id=? AND org_id=?`).run(kind, kind, id, org);
    audit(
      id,
      author,
      kind === "agent" ? "Respuesta del equipo" : "Mensaje del cliente",
    );
    changed(org);
  });
}

export function updateMetadata(org: string, id: string, expectedVersion: number, data: { status: Ticket["status"]; priority: Ticket["priority"]; assigned_to: string | null }, actor: string) {
  return transaction(() => {
    const result = db().prepare(`UPDATE tickets SET status=?, priority=?, assigned_to=?, version=version+1, updated_at=${nowSql},
      closed_at=CASE WHEN ?='closed' AND status<>'closed' THEN ${nowSql} WHEN ?<>'closed' AND status='closed' THEN NULL ELSE closed_at END
      WHERE id=? AND org_id=? AND version=?`).run(data.status, data.priority, data.assigned_to, data.status, data.status, id, org, expectedVersion);
    if (!result.changes) return { conflict: true, ticket: getTicket(org, id) };
    audit(id, actor, `Estado: ${data.status}; prioridad: ${data.priority}; asignación: ${data.assigned_to || "sin asignar"}`);
    changed(org);
    return { conflict: false, ticket: getTicket(org, id) };
  });
}

export function metrics(org: string) {
  const row = db().prepare(`SELECT
    count(*) FILTER (WHERE first_response_at IS NULL AND status<>'closed') AS awaitingFirstResponse,
    count(*) FILTER (WHERE first_response_at IS NULL AND status<>'closed' AND julianday('now') > julianday(created_at) + (CASE priority WHEN 'high' THEN 1 ELSE 4 END)/24.0) AS overdueFirstResponse,
    avg((julianday(first_response_at)-julianday(created_at))*24*60) AS firstResponseMinutes,
    count(first_response_at) AS firstResponseCount,
    avg((julianday(closed_at)-julianday(created_at))*24*60) FILTER (WHERE status='closed' AND closed_at IS NOT NULL) AS resolutionMinutes,
    count(*) FILTER (WHERE status='closed' AND closed_at IS NOT NULL) AS resolutionCount
    FROM tickets WHERE org_id=?`).get(org) as Record<string, number | null>;
  const workload = db().prepare(`SELECT u.id,u.name,count(t.id) AS openTickets
    FROM users u LEFT JOIN tickets t ON t.assigned_to=u.id AND t.org_id=u.org_id AND t.status<>'closed'
    WHERE u.org_id=? GROUP BY u.id,u.name UNION ALL
    SELECT NULL AS id,'Sin asignar' AS name,count(*) AS openTickets FROM tickets WHERE org_id=? AND assigned_to IS NULL AND status<>'closed'`).all(org, org)
    .map((row) => plainRecord(row as Record<string, unknown>) as { id: string | null; name: string; openTickets: number });
  return { sla: { target: "wall-clock", highHours: 1, normalHours: 4, awaitingFirstResponse: row.awaitingFirstResponse ?? 0, overdueFirstResponse: row.overdueFirstResponse ?? 0 }, metrics: { firstResponse: { count: row.firstResponseCount ?? 0, averageMinutes: row.firstResponseMinutes }, resolution: { count: row.resolutionCount ?? 0, averageMinutes: row.resolutionMinutes }, workload } };
}
