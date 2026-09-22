import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isRecruiterDemoAdmin,
  resetRecruiterFixture,
} from "@/lib/recruiter-fixture";
import { failure, HttpError, limit, readBody, sameOrigin } from "@/lib/security";

const recruiterOrg = "recruiter-demo";

export async function POST(request: Request) {
  try {
    if (process.env.DEMO_MODE !== "true")
      throw new HttpError(404, "unavailable");
    sameOrigin(request);
    const user = await requireUser();
    if (!isRecruiterDemoAdmin(user))
      throw new HttpError(403, "demo_reset_forbidden");
    limit(`demo-reset:${user.id}`, 5);
    await readBody(request);
    resetRecruiterFixture();
    const counts = db()
      .prepare(
        `SELECT
          (SELECT count(*) FROM tickets WHERE org_id=?) AS tickets,
          (SELECT count(*) FROM messages m JOIN tickets t ON t.id=m.ticket_id WHERE t.org_id=?) AS messages,
          (SELECT count(*) FROM events e JOIN tickets t ON t.id=e.ticket_id WHERE t.org_id=?) AS events`,
      )
      .get(recruiterOrg, recruiterOrg, recruiterOrg);
    return Response.json({ reset: true, ...counts });
  } catch (error) {
    return await failure(error);
  }
}
