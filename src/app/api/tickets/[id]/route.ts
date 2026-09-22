import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTicket, history, messages, reply, updateMetadata } from "@/lib/tickets";
import {
  failure,
  HttpError,
  limit,
  readBody,
  sameOrigin,
  text,
} from "@/lib/security";
import { error } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const user = await requireUser(),
      { id } = await context.params;
    const ticket = getTicket(user.org_id, id);
    return Response.json(
      { ticket, messages: messages(id), history: history(id) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return await failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    sameOrigin(request);
    const user = await requireUser(),
      { id } = await context.params;
    limit("ticket:" + user.id, 60);
    const ticket = getTicket(user.org_id, id);
    const data = await readBody(request);
    if (data.action === "reply")
      reply(user.org_id, id, user.name, text(data, "body", 4000), "agent");
    else if (data.action === "update") {
      const expectedVersion = data.expectedVersion;
      if (!Number.isInteger(expectedVersion) || (expectedVersion as number) < 1)
        throw new HttpError(400, "invalid_ticket_version");
      const status = text(data, "status", 10),
        priority = text(data, "priority", 10);
      const assigned =
        data.assigned_to === "" ? null : text(data, "assigned_to", 100);
      if (
        !["open", "pending", "closed"].includes(status) ||
        !["normal", "high"].includes(priority)
      )
        throw new HttpError(400, "invalid_ticket_metadata");
      if (
        assigned &&
        !db()
          .prepare("SELECT id FROM users WHERE id=? AND org_id=?")
          .get(assigned, user.org_id)
      )
        throw new HttpError(400, "invalid_agent");
      const result = updateMetadata(user.org_id, id, expectedVersion as number, { status: status as "open" | "pending" | "closed", priority: priority as "normal" | "high", assigned_to: assigned }, user.name);
      if (result.conflict)
        return Response.json({ error: error(await getLocale(), "ticket_conflict"), currentVersion: result.ticket.version, ticket: result.ticket }, { status: 409 });
      return Response.json({ ok: true, ticket: result.ticket });
    } else if (data.action === "analyze") {
      const body = messages(id)
        .filter((m) => m.kind === "customer")
        .slice(-5)
        .map((m) => m.body)
        .join("\n")
        .slice(0, 6000);
      try {
        const response = await fetch(
          process.env.ANALYZER_URL || "http://127.0.0.1:8001/analyze",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: body, language: ticket.language }),
            signal: AbortSignal.timeout(3000),
            cache: "no-store",
          },
        );
        if (!response.ok) throw new Error("Analyzer unavailable");
        const result = await response.json();
        if (
          typeof result.category !== "string" ||
          typeof result.summary !== "string"
        )
          throw new Error("Invalid analysis");
        return Response.json(result);
      } catch {
        throw new HttpError(
          503,
          "analyzer_unavailable",
        );
      }
    } else throw new HttpError(400, "invalid_action");
    return Response.json({ ok: true, ticket: getTicket(user.org_id, id) });
  } catch (error) {
    return await failure(error);
  }
}
