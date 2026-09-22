import { requireAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { failure, HttpError, readBody, sameOrigin, text } from "@/lib/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    requireAdmin(user);
    const data = await readBody(request),
      name = text(data, "name", 100),
      origin = text(data, "origin", 250);
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new HttpError(400, "invalid_url");
    }
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin
    )
      throw new HttpError(
        400,
        "invalid_origin_url",
      );
    db()
      .prepare("UPDATE organizations SET name=?,allowed_origin=? WHERE id=?")
      .run(name, origin, user.org_id);
    return Response.json({ ok: true });
  } catch (error) {
    return await failure(error);
  }
}
