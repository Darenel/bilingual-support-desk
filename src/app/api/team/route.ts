import { requireAdmin, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomUUID } from "node:crypto";
import {
  email,
  failure,
  hashPassword,
  HttpError,
  limit,
  readBody,
  sameOrigin,
  secret,
  text,
} from "@/lib/security";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    requireAdmin(user);
    limit("team:" + user.id, 10);
    const data = await readBody(request),
      address = email(data),
      name = text(data, "name", 100),
      password = secret(data, "password", 128, 10);
    if (db().prepare("SELECT id FROM users WHERE email=?").get(address))
      throw new HttpError(409, "email_unavailable");
    db()
      .prepare(
        "INSERT INTO users(id,org_id,name,first_name,last_name,email,password_hash,role) VALUES (?,?,?,?,?,?,?,'agent')",
      )
      .run(randomUUID(), user.org_id, name, name, "", address, hashPassword(password));
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return await failure(error);
  }
}
