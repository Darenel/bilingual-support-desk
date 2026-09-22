import { db } from "./db";
import { digest, HttpError } from "./security";
import { publicTicket } from "./tickets";

export type WidgetOrganization = { id: string; allowed_origin: string };
export function widgetCors(origin: string | null): Record<string, string> {
  return origin ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Headers": "Content-Type, X-Widget-Key, X-Conversation-Token, X-Support-Language, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" } : {};
}
export function widgetOrigin(request: Request) {
  const value = request.headers.get("origin");
  try { return value && new URL(value).origin === value ? value : null; } catch { return null; }
}
export function widgetOrganization(request: Request) {
  const key = request.headers.get("x-widget-key");
  if (!key || key.length > 128) throw new HttpError(401, "invalid_widget_key");
  const org = db().prepare("SELECT id,allowed_origin FROM organizations WHERE widget_key=?").get(key) as WidgetOrganization | undefined;
  const requestOrigin = widgetOrigin(request);
  if (!org || (request.headers.has("origin") && (!requestOrigin || org.allowed_origin !== requestOrigin))) throw new HttpError(403, "origin_forbidden");
  return { org, requestOrigin };
}
export function widgetConversation(org: WidgetOrganization, request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const value = bearer || request.headers.get("x-conversation-token");
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new HttpError(401, "invalid_widget_conversation");
  return publicTicket(org.id, digest(value));
}
