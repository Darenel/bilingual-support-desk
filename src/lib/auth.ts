import { cookies } from "next/headers";
import { db } from "./db";
import { plainRecord } from "./plain.mjs";
import { digest, HttpError } from "./security";
import type { User } from "./types";

export async function currentUser(): Promise<User | null> {
  const value = (await cookies()).get("support_session")?.value;
  return value ? sessionUser(value) : null;
}
export function sessionUser(value: string): User | null {
  const row = db()
    .prepare(
      `SELECT u.id,u.org_id,u.name,COALESCE(NULLIF(u.first_name,''),u.name) AS first_name,u.last_name,u.username,u.email,u.role,o.name AS org_name
    FROM sessions s JOIN users u ON u.id=s.user_id JOIN organizations o ON o.id=u.org_id
    WHERE s.token_hash=? AND s.expires>?`,
    )
    .get(digest(value), Date.now());
  return row ? plainRecord(row as User) : null;
}
export function sessionFromRequest(request: Request) {
  const value = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("support_session="))?.slice("support_session=".length);
  return value ? { value, user: sessionUser(value) } : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "unauthorized");
  return user;
}
export function requireAdmin(user: User) {
  if (user.role !== "admin")
    throw new HttpError(
      403,
      "admin_required",
    );
}
