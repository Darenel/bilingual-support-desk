import { requireUser } from "@/lib/auth";
import { metrics } from "@/lib/tickets";
import { failure } from "@/lib/security";

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json(metrics(user.org_id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return await failure(error);
  }
}
