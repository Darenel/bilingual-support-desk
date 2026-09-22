import {
  createTicket,
  publicMessages,
  publicTicket,
  reply,
} from "@/lib/tickets";
import {
  digest,
  HttpError,
  limit,
  readBody,
  requestLocale,
  text,
  token,
} from "@/lib/security";
import { error as localizedError } from "@/lib/i18n";
import { db } from "@/lib/db";
import { widgetConversation, widgetCors, widgetOrganization, widgetOrigin } from "@/lib/widget";

export const runtime = "nodejs";
function response(
  body: Record<string, unknown>,
  requestOrigin: string | null,
  status = 200,
) {
  return Response.json(body, {
    status,
    headers: { ...widgetCors(requestOrigin), "Cache-Control": "no-store" },
  });
}

export async function OPTIONS(request: Request) {
  const requestOrigin = widgetOrigin(request);
  if (
    !requestOrigin ||
    !db()
      .prepare("SELECT id FROM organizations WHERE allowed_origin=?")
      .get(requestOrigin)
  )
    return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: widgetCors(requestOrigin) });
}

export async function GET(request: Request) {
  let requestOrigin: string | null = null;
  try {
    const context = widgetOrganization(request);
    requestOrigin = context.requestOrigin;
    limit(
      `widget-read:${context.org.id}:${requestOrigin || "same-origin"}`,
      120,
    );
    const ticket = widgetConversation(context.org, request);
    return response(
      { ticket, messages: publicMessages(ticket.id) },
      requestOrigin,
    );
  } catch (error) {
    return response(
      {
        error:
          error instanceof HttpError
            ? localizedError(requestLocale(request), error.code, error.values)
            : localizedError(requestLocale(request), "unexpected"),
      },
      requestOrigin,
      error instanceof HttpError ? error.status : 500,
    );
  }
}

export async function POST(request: Request) {
  let requestOrigin: string | null = null;
  try {
    const context = widgetOrganization(request);
    requestOrigin = context.requestOrigin;
    limit(
      `widget-write:${context.org.id}:${requestOrigin || "same-origin"}`,
      30,
    );
    const data = await readBody(request);
    if (data.action === "create") {
      const conversationToken = token();
      const id = createTicket(
        context.org.id,
        data,
        "widget",
        digest(conversationToken),
      );
      const ticket = publicTicket(context.org.id, digest(conversationToken));
      return response(
        { ticket, messages: publicMessages(id), conversationToken },
        requestOrigin,
        201,
      );
    }
    if (data.action === "message") {
      const ticket = widgetConversation(context.org, request);
      reply(
        context.org.id,
        ticket.id,
        ticket.customer,
        text(data, "body", 4000),
        "customer",
      );
      return response(
        { ticket: widgetConversation(context.org, request), messages: publicMessages(ticket.id) },
        requestOrigin,
      );
    }
    throw new HttpError(400, "invalid_action");
  } catch (error) {
    return response(
      {
        error:
          error instanceof HttpError
            ? localizedError(requestLocale(request), error.code, error.values)
            : localizedError(requestLocale(request), "unexpected"),
      },
      requestOrigin,
      error instanceof HttpError ? error.status : 500,
    );
  }
}
