import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { db } from "./db";
import { error, type Locale } from "./i18n";
import { getLocale } from "./i18n-server";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public values?: Record<string, string | number>,
  ) {
    super(code);
  }
}
export const token = () => randomBytes(32).toString("hex");
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
}
export function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  const expected = Buffer.from(hash, "hex");
  return timingSafeEqual(scryptSync(password, salt, 64), expected);
}
export function limit(key: string, max: number, windowMs = 60000) {
  const now = Date.now();
  db().prepare("DELETE FROM rate_limits WHERE expires < ?").run(now);
  db()
    .prepare(
      "INSERT INTO rate_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
    )
    .run(key, now + windowMs);
  const row = db()
    .prepare("SELECT count FROM rate_limits WHERE key=?")
    .get(key) as { count: number };
  if (row.count > max)
    throw new HttpError(429, "rate_limited");
}
export function text(
  data: Record<string, unknown>,
  key: string,
  max = 200,
  min = 1,
) {
  const value = data[key];
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.length > max
  )
    throw new HttpError(
      400,
      "invalid_field",
      { field: key, min, max },
    );
  return value.trim();
}
export function secret(
  data: Record<string, unknown>,
  key: string,
  max = 128,
  min = 10,
) {
  const value = data[key];
  if (typeof value !== "string" || value.length < min || value.length > max)
    throw new HttpError(
      400,
      "invalid_field",
      { field: key, min, max },
    );
  return value;
}
export function email(data: Record<string, unknown>) {
  const value = text(data, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
    throw new HttpError(400, "invalid_email");
  return value;
}
export async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "json_required");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "body_required");
  let size = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16000) {
      await reader.cancel();
      throw new HttpError(413, "body_too_large");
    }
    parts.push(value);
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
export function sameOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (request.headers.get("origin") !== expected)
    throw new HttpError(403, "origin_forbidden");
}
export function requestLocale(request: Request): Locale {
  const value = request.headers.get("x-support-language") || request.headers.get("accept-language")?.slice(0, 2);
  return value === "es" ? "es" : "en";
}
export async function failure(errorValue: unknown, locale?: Locale) {
  const resolvedLocale = locale ?? await getLocale();
  if (errorValue instanceof HttpError)
    return Response.json({ error: error(resolvedLocale, errorValue.code, errorValue.values) }, { status: errorValue.status });
  console.error(
    "Request failed:",
    errorValue instanceof Error ? errorValue.message : "Unknown error",
  );
  return Response.json(
    { error: error(resolvedLocale, "unexpected") },
    { status: 500 },
  );
}
