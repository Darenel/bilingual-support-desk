import { requireUser } from "@/lib/auth";
import { createTicket, presentTicket } from "@/lib/tickets";
import { db } from "@/lib/db";
import { failure, limit, readBody, sameOrigin } from "@/lib/security";
export async function GET() {
  try {
    const user = await requireUser();
    const tickets = db()
      .prepare(
        "SELECT * FROM tickets WHERE org_id=? ORDER BY updated_at DESC",
      )
      .all(user.org_id);
    return Response.json(
      { tickets: tickets.map((ticket) => presentTicket(ticket as never) ) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return await failure(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    limit("create:" + user.id, 30);
    const id = createTicket(user.org_id, await readBody(request), user.name);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return await failure(error);
  }
}
