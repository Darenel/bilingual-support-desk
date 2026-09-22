import { cookies } from "next/headers";
import { db, transaction } from "@/lib/db";
import {
  digest,
  email,
  failure,
  hashPassword,
  HttpError,
  limit,
  readBody,
  sameOrigin,
  secret,
  text,
  token,
  verifyPassword,
} from "@/lib/security";
import { randomUUID } from "node:crypto";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    sameOrigin(request);
    limit("auth-global", 100);
    const data = await readBody(request);
    const jar = await cookies();
    if (data.action === "logout") {
      const old = jar.get("support_session")?.value;
      if (old)
        db()
          .prepare("DELETE FROM sessions WHERE token_hash=?")
          .run(digest(old));
      jar.delete("support_session");
      return Response.json({ ok: true });
    }
    const address = email(data);
    const appOrigin = new URL(process.env.APP_ORIGIN || request.url).origin;
    limit("auth:" + address, 10, 600000);
    const password = secret(data, "password", 128, 10);
    let userId: string;
    if (data.action === "register") {
      const name = text(data, "name", 100);
      const company = text(data, "company", 100);
      if (db().prepare("SELECT id FROM users WHERE email=?").get(address))
        throw new HttpError(409, "email_unavailable");
      const passwordHash = hashPassword(password);
      userId = transaction(() => {
        const org = randomUUID(),
          id = randomUUID();
        db()
          .prepare(
            "INSERT INTO organizations(id,name,widget_key,allowed_origin) VALUES (?,?,?,?)",
          )
          .run(org, company, token(), appOrigin);
        db()
          .prepare(
          "INSERT INTO users(id,org_id,name,first_name,last_name,email,password_hash,role) VALUES (?,?,?,?,?,?,?,?)",
      )
          .run(id, org, name, name, "", address, passwordHash, "admin");
        return id;
      });
    } else if (data.action === "login") {
      const user = db()
        .prepare("SELECT id,password_hash FROM users WHERE email=?")
        .get(address) as { id: string; password_hash: string } | undefined;
      if (!user || !verifyPassword(password, user.password_hash))
        throw new HttpError(401, "invalid_credentials");
      userId = user.id;
    } else throw new HttpError(400, "invalid_action");
    const previous = jar.get("support_session")?.value;
    if (previous)
      db()
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .run(digest(previous));
    const session = token();
    db().prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
    db()
      .prepare(
        "INSERT INTO sessions(token_hash,user_id,expires) VALUES (?,?,?)",
      )
      .run(digest(session), userId, Date.now() + 8 * 3600000);
    jar.set("support_session", session, {
      httpOnly: true,
      sameSite: "lax",
      secure: appOrigin.startsWith("https:"),
      path: "/",
      maxAge: 28800,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return await failure(error);
  }
}
