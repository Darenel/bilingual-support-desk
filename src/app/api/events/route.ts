import { sessionFromRequest } from "@/lib/auth";
import { changeMarker } from "@/lib/tickets";
import { error as localizedError } from "@/lib/i18n";
import { requestLocale } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const active = new Map<string, number>();

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session?.user)
    return Response.json({ error: localizedError(requestLocale(request), "unauthorized") }, { status: 401 });
  const initialUser = session.user;
  const key = `${initialUser.org_id}:${initialUser.id}`;
  if ((active.get(key) || 0) >= 3)
    return Response.json({ error: localizedError(requestLocale(request), "too_many_connections") }, { status: 429 });
  active.set(key, (active.get(key) || 0) + 1);

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const release = () => {
    if (closed) return false;
    closed = true;
    if (timer) clearInterval(timer);
    const remaining = (active.get(key) || 1) - 1;
    if (remaining) active.set(key, remaining);
    else active.delete(key);
    return true;
  };
  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (release()) controller.close();
      };
      let previous = JSON.stringify(changeMarker(initialUser.org_id));
      controller.enqueue(encoder.encode(`event: change\ndata: ${previous}\n\n`));
      timer = setInterval(() => {
        try {
          const user = sessionFromRequest(request)?.user;
          if (!user || user.id !== initialUser.id || user.org_id !== initialUser.org_id)
            return close();
          const next = JSON.stringify(changeMarker(user.org_id));
          if (next !== previous) {
            previous = next;
            controller.enqueue(encoder.encode(`event: change\ndata: ${next}\n\n`));
          } else controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          close();
        }
      }, 1500);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      release();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
