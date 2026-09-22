import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const base = process.env.TEST_BASE_URL;
if (process.env.TEST_MODE !== "true" || !base) throw new Error("Requires isolated integration environment.");

async function request(path, { cookie, method = "POST", body } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
  return { response, json: await response.json(), cookie: response.headers.get("set-cookie")?.split(";", 1)[0] };
}
async function register(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const email = `${slug}-${Date.now()}@example.test`;
  const result = await request("/api/auth", { body: { action: "register", name, company: name, email, password: "correct-horse-1" } });
  assert.equal(result.response.status, 200);
  const database = new DatabaseSync(process.env.TEST_DATABASE_PATH, { readOnly: true });
  const organization = database.prepare("SELECT o.allowed_origin FROM organizations o JOIN users u ON u.org_id=o.id WHERE u.email=?").get(email);
  database.close();
  assert.equal(organization.allowed_origin, base);
  return result.cookie;
}

test("version conflicts, SLA snapshot, and close/reopen metrics are factual", { concurrency: false }, async () => {
  const cookie = await register("Operations");
  const created = await request("/api/tickets", { cookie, body: { subject: "SLA", customer: "Customer", email: "customer@example.test", body: "Need help", language: "en" } });
  const id = created.json.id;
  const database = new DatabaseSync(process.env.TEST_DATABASE_PATH);
  database.prepare("UPDATE tickets SET created_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour') WHERE id=?").run(id);
  database.close();
  const first = await request(`/api/tickets/${id}`, { cookie, method: "GET" });
  const version = first.json.ticket.version;
  const updated = await request(`/api/tickets/${id}`, { cookie, body: { action: "update", expectedVersion: version, status: "pending", priority: "normal", assigned_to: "" } });
  assert.equal(updated.response.status, 200);
  const stale = await request(`/api/tickets/${id}`, { cookie, body: { action: "update", expectedVersion: version, status: "closed", priority: "high", assigned_to: "" } });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.json.currentVersion, version + 1);
  await request(`/api/tickets/${id}`, { cookie, body: { action: "reply", body: "First reply" } });
  const replied = await request(`/api/tickets/${id}`, { cookie, method: "GET" });
  assert.equal(replied.json.ticket.first_response_sla_hours, 4);
  const priorityChange = await request(`/api/tickets/${id}`, { cookie, body: { action: "update", expectedVersion: replied.json.ticket.version, status: "pending", priority: "high", assigned_to: "" } });
  assert.equal(priorityChange.json.ticket.first_response_sla_hours, 4);
  const closed = await request(`/api/tickets/${id}`, { cookie, body: { action: "update", expectedVersion: priorityChange.json.ticket.version, status: "closed", priority: "high", assigned_to: "" } });
  const reopened = await request(`/api/tickets/${id}`, { cookie, body: { action: "update", expectedVersion: closed.json.ticket.version, status: "open", priority: "high", assigned_to: "" } });
  const metrics = await request("/api/metrics", { cookie, method: "GET" });
  assert.equal(metrics.json.metrics.resolution.count, 0);
  const reclosed = await request(`/api/tickets/${id}`, { cookie, body: { action: "update", expectedVersion: reopened.json.ticket.version, status: "closed", priority: "high", assigned_to: "" } });
  assert.ok(reclosed.json.ticket.closed_at);
  const finalMetrics = await request("/api/metrics", { cookie, method: "GET" });
  assert.equal(finalMetrics.json.metrics.resolution.count, 1);
  assert.ok(finalMetrics.json.metrics.firstResponse.averageMinutes > 50);
});

test("widget event preflight does not require credential headers", { concurrency: false }, async () => {
  const cookie = await register("Widget Origin");
  const settings = await request("/api/settings", { cookie, body: { name: "Widget Origin", origin: "https://widget.example.test" } });
  assert.equal(settings.response.status, 200);
  const response = await fetch(`${base}/api/widget/events`, { method: "OPTIONS", headers: { Origin: "https://widget.example.test", "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization,x-widget-key" } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://widget.example.test");
  const blocked = await fetch(`${base}/api/widget/events`, { method: "OPTIONS", headers: { Origin: "https://evil.example.test", "Access-Control-Request-Method": "GET" } });
  assert.equal(blocked.status, 403);
});

test("widget stream delivers its own ticket change", { concurrency: false }, async () => {
  const cookie = await register("Widget Stream");
  await request("/api/settings", { cookie, body: { name: "Widget Stream", origin: "https://stream.example.test" } });
  const database = new DatabaseSync(process.env.TEST_DATABASE_PATH, { readOnly: true });
  const key = database.prepare("SELECT widget_key FROM organizations WHERE allowed_origin=?").get("https://stream.example.test").widget_key;
  database.close();
  const create = await fetch(`${base}/api/widget`, { method: "POST", headers: { Origin: "https://stream.example.test", "Content-Type": "application/json", "X-Widget-Key": key }, body: JSON.stringify({ action: "create", subject: "Stream", customer: "Visitor", email: "visitor@example.test", body: "Need help", language: "en" }) });
  const conversation = await create.json();
  assert.equal(create.status, 201);
  const stream = await fetch(`${base}/api/widget/events`, { headers: { Origin: "https://stream.example.test", "X-Widget-Key": key, Authorization: `Bearer ${conversation.conversationToken}` } });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  try {
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: change/);
    await request(`/api/tickets/${conversation.ticket.id}`, { cookie, body: { action: "reply", body: "Reply" } });
    const changed = await Promise.race([
      reader.read(),
      new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    assert.ok(changed && !changed.done);
    assert.match(new TextDecoder().decode(changed.value), /event: change/);
  } finally { await reader.cancel(); }
});

test("authenticated event stream closes after logout", { concurrency: false }, async () => {
  const cookie = await register("SSE Session");
  const stream = await fetch(`${base}/api/events`, { headers: { Cookie: cookie } });
  assert.equal(stream.status, 200);
  const reader = stream.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: change/);
  const logout = await request("/api/auth", { cookie, body: { action: "logout" } });
  assert.equal(logout.response.status, 200);
  const closed = await Promise.race([
    (async () => { while (!(await reader.read()).done) {} return true; })(),
    new Promise((resolve) => setTimeout(() => resolve(false), 4000)),
  ]);
  await reader.cancel();
  assert.equal(closed, true);
});

test("dashboard stream does not publish another organization change", { concurrency: false }, async () => {
  const a = await register("SSE A");
  const b = await register("SSE B");
  const stream = await fetch(`${base}/api/events`, { headers: { Cookie: a } });
  const reader = stream.body.getReader();
  try {
    await reader.read();
    const created = await request("/api/tickets", { cookie: b, body: { subject: "Other org", customer: "Other", email: "other@example.test", body: "Private", language: "en" } });
    assert.equal(created.response.status, 201);
    const next = await Promise.race([reader.read(), new Promise((resolve) => setTimeout(() => resolve(null), 4000))]);
    assert.ok(next && !next.done);
    assert.match(new TextDecoder().decode(next.value), /^: keepalive/);
  } finally { await reader.cancel(); }
});
