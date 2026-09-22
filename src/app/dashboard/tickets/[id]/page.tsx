import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTicket, history, messages } from "@/lib/tickets";
import { plainRecord } from "@/lib/plain.mjs";
import { ReplyForm, TicketControls } from "@/components/forms";
import type { Event, Message } from "@/lib/types";
import { SlaStatus } from "@/components/sla-status";
import { formatDate, historyLabel } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
export default async function TicketDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) return null;
  const locale = await getLocale();
  const es = locale === "es";
  const { id } = await params;
  let ticket;
  try {
    ticket = getTicket(user.org_id, id);
  } catch {
    notFound();
  }
  const agents = db()
    .prepare("SELECT id,name FROM users WHERE org_id=? ORDER BY name")
    .all(user.org_id)
    .map((agent) => plainRecord(agent)) as { id: string; name: string }[];
  const thread = messages(id),
    events = history(id) as Event[];
  const agentNames = Object.fromEntries(agents.map((agent) => [agent.id, agent.name]));
  return (
    <>
      <header className="detail-head">
        <div>
          <Link href="/dashboard/tickets" className="back">
            {es ? "← Tickets" : "← Tickets"}
          </Link>
          <p className="eyebrow">
            {ticket.language === "es" ? "ESPAÑOL" : "ENGLISH"} ·{" "}
            {ticket.customer}
          </p>
          <h1>{ticket.subject}</h1>
          <p>{ticket.email}</p>
        </div>
        <span className={"badge " + ticket.priority}>
          {ticket.priority === "high" ? (es ? "Prioridad alta" : "High priority") : (es ? "Prioridad normal" : "Normal priority")}
        </span>
      </header>
      <p className="sla-detail">
        <SlaStatus ticket={ticket} initialNow={new Date().getTime()} />
      </p>
      <div className="ticket-detail">
        <section className="thread">
          {thread.map((message: Message) => (
            <article className={"message " + message.kind} key={message.id}>
              <div>
                <b>{message.author}</b>
                <time>
                  {formatDate(locale, message.created_at, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </time>
              </div>
              <p>{message.body}</p>
            </article>
          ))}
          <ReplyForm id={id} />
        </section>
        <div>
          <TicketControls id={id} ticket={ticket} agents={agents} />
          <section className="history">
            <h2>{es ? "Historial" : "History"}</h2>
            {events.map((event) => (
              <p key={event.id}>
                <b>{event.actor}</b> · {historyLabel(locale, event.action, agentNames)}
                <time>
                  {formatDate(locale, event.created_at, {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </time>
              </p>
            ))}
          </section>
        </div>
      </div>
    </>
  );
}
