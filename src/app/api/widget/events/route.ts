import { HttpError, requestLocale } from "@/lib/security";
import { error as localizedError } from "@/lib/i18n";
import { db } from "@/lib/db";
import { widgetConversation, widgetCors, widgetOrganization, widgetOrigin } from "@/lib/widget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const active = new Map<string, number>();

export async function OPTIONS(request: Request) {
  const requestOrigin = widgetOrigin(request);
  if (!requestOrigin || !db().prepare("SELECT id FROM organizations WHERE allowed_origin=?").get(requestOrigin))
    return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: widgetCors(requestOrigin) });
}

export async function GET(request: Request) {
  let requestOrigin: string | null = null;
  try {
    const context = widgetOrganization(request);
    requestOrigin = context.requestOrigin;
    const ticket = widgetConversation(context.org, request);
    const value = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if (!value) throw new HttpError(401, "invalid_widget_conversation");
    if ((active.get(value) || 0) >= 3)
      throw new HttpError(429, "too_many_connections");
    active.set(value, (active.get(value) || 0) + 1);
    const encoder = new TextEncoder();
    let timer: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    const release = () => {
      if (closed) return false;
      closed = true;
      if (timer) clearInterval(timer);
      const remaining = (active.get(value) || 1) - 1;
      if (remaining) active.set(value, remaining);
      else active.delete(value);
      return true;
    };
    const stream = new ReadableStream({
      start(controller) {
        const close = () => { if (release()) controller.close(); };
        let previous = JSON.stringify({ ticketId: ticket.id, revision: ticket.version });
        controller.enqueue(encoder.encode(`event: change\ndata: ${previous}\n\n`));
        timer = setInterval(() => {
          // Revalidate bearer access so an invalidated public conversation cannot keep streaming.
          try {
            const fresh = widgetOrganization(request);
            if (fresh.org.id !== context.org.id) throw new HttpError(403, "origin_forbidden");
            const current = widgetConversation(fresh.org, new Request(request.url, { headers: { "x-conversation-token": value } }));
            const next = JSON.stringify({ ticketId: current.id, revision: current.version });
            if (next !== previous) { previous = next; controller.enqueue(encoder.encode(`event: change\ndata: ${next}\n\n`)); }
            else controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch { close(); }
        }, 1500);
        request.signal.addEventListener("abort", close, { once: true });
      },
      cancel() { release(); },
    });
    return new Response(stream, { headers: { ...widgetCors(requestOrigin), "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
  } catch (error) {
    return Response.json({ error: error instanceof HttpError ? localizedError(requestLocale(request), error.code, error.values) : localizedError(requestLocale(request), "unexpected") }, { status: error instanceof HttpError ? error.status : 500, headers: widgetCors(requestOrigin) });
  }
}
