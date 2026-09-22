import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { isRecruiterDemoAdmin } from "@/lib/recruiter-fixture";
import { digest, email, failure, hashPassword, HttpError, limit, readBody, sameOrigin, secret, text, verifyPassword } from "@/lib/security";

const profile = (userId: string) => db().prepare("SELECT COALESCE(NULLIF(first_name,''),name) AS first_name,last_name,username,email,role FROM users WHERE id=?").get(userId) as { first_name: string; last_name: string; username: string | null; email: string; role: string };
const locked = (user: Awaited<ReturnType<typeof requireUser>>) => isRecruiterDemoAdmin(user);

export async function GET() {
  try {
    const user = await requireUser();
    return Response.json({ profile: { ...profile(user.id), locked: locked(user) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return await failure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    limit("profile:" + user.id, 10);
    const data = await readBody(request);
    const session = (await cookies()).get("support_session")?.value;
    const current = profile(user.id);
    const firstName = text(data, "first_name", 100);
    if (typeof data.last_name !== "string") throw new HttpError(400, "invalid_field", { field: "last_name", min: 0, max: 100 });
    const lastName = data.last_name.trim();
    if (lastName.length > 100) throw new HttpError(400, "invalid_field", { field: "last_name", min: 0, max: 100 });
    if (typeof data.username !== "string") throw new HttpError(400, "invalid_username");
    const username = data.username.trim().toLowerCase();
    if (username && !/^[a-z0-9_]{3,32}$/.test(username)) throw new HttpError(400, "invalid_username");
    const address = email(data);
    if (data.password !== undefined && typeof data.password !== "string") throw new HttpError(400, "invalid_field", { field: "password", min: 10, max: 128 });
    const password = data.password === undefined || data.password === "" ? "" : secret(data, "password", 128, 10);
    if (password && data.confirm_password !== password) throw new HttpError(400, "password_confirmation");
    const identityChanged = address !== current.email || (username || null) !== current.username;
    const currentPassword = identityChanged || password ? secret(data, "current_password", 128, 10) : "";
    const displayName = [firstName, lastName].filter(Boolean).join(" ");
    try {
      transaction(() => {
        const fresh = profile(user.id);
        const freshIdentityChanged = address !== fresh.email || (username || null) !== fresh.username;
        const credential = db().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id) as { password_hash: string } | undefined;
        if ((freshIdentityChanged || password) && (!currentPassword || !credential || !verifyPassword(currentPassword, credential.password_hash)))
          throw new HttpError(401, "invalid_current_password");
        if (locked(user) && (firstName !== fresh.first_name || lastName !== fresh.last_name || freshIdentityChanged || password))
          throw new HttpError(403, "demo_profile_locked");
        db().prepare("UPDATE users SET name=?,first_name=?,last_name=?,username=?,email=?,password_hash=COALESCE(?,password_hash) WHERE id=?")
          .run(displayName, firstName, lastName, username || null, address, password ? hashPassword(password) : null, user.id);
        if (freshIdentityChanged || password) {
          if (session) db().prepare("DELETE FROM sessions WHERE user_id=? AND token_hash<>?").run(user.id, digest(session));
        }
      });
    } catch (error) {
      if (error instanceof Error && (error.message.includes("users_email_ci") || error.message.includes("users.email"))) throw new HttpError(409, "email_unavailable");
      if (error instanceof Error && error.message.includes("users_username_ci")) throw new HttpError(409, "username_unavailable");
      throw error;
    }
    return Response.json({ profile: { ...profile(user.id), locked: locked(user) } });
  } catch (error) {
    return await failure(error);
  }
}
