import assert from "node:assert/strict";
import test from "node:test";

const base = new URL(process.env.TEST_BASE_URL || "http://localhost:3000");

if (
  process.env.TEST_MODE !== "true" ||
  !process.env.TEST_DATABASE_PATH ||
  !["localhost", "127.0.0.1"].includes(base.hostname)
) {
  throw new Error("Set TEST_MODE=true with a disposable loopback test database.");
}

function unique(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request(path, { body, cookie, headers = {}, method = "POST", origin = base.origin } = {}) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  return { response, json, text, cookie: response.headers.get("set-cookie")?.split(";", 1)[0] };
}

async function page(path, cookie) {
  const response = await fetch(new URL(path, base), { headers: { Cookie: cookie } });
  return { response, body: await response.text() };
}

async function register(label) {
  const email = `${unique(label.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}@example.test`;
  const result = await request("/api/auth", {
    body: { action: "register", name: label, company: `${label} test org`, email, password: "security-test-1" },
  });
  assert.equal(result.response.status, 200);
  assert.ok(result.cookie);
  return { email, cookie: result.cookie };
}

async function widgetKey(cookie) {
  const result = await page("/dashboard/settings", cookie);
  assert.equal(result.response.status, 200);
  const match = result.body.match(/data-key=(?:&quot;|")([a-f0-9]{32,})(?:&quot;|")/);
  assert.ok(match, "settings page did not contain this test organization widget key");
  return match[1];
}

test("security boundaries hold for synthetic organizations on loopback", { concurrency: false }, async (t) => {
  const a = await register("Security A");
  const b = await register("Security B");
  const badLogin = await request("/api/auth", { body: { action: "login", email: a.email, password: "incorrect-password" } });
  assert.equal(badLogin.response.status, 401);
  assert.equal((await request("/api/tickets", { method: "GET" })).response.status, 401);

  const malformed = await request("/api/tickets", { cookie: a.cookie, body: "{", headers: { "Content-Type": "application/json" } });
  assert.equal(malformed.response.status, 400);
  const oversized = await request("/api/tickets", { cookie: a.cookie, body: "x".repeat(16_001), headers: { "Content-Type": "application/json" } });
  assert.equal(oversized.response.status, 413);
  const foreignOrigin = await request("/api/tickets", {
    cookie: a.cookie,
    origin: "https://unsafe.example.test",
    body: { subject: "must not create", customer: "Synthetic", email: "synthetic@example.test", body: "blocked", language: "en" },
  });
  assert.equal(foreignOrigin.response.status, 403);

  const created = await request("/api/tickets", {
    cookie: a.cookie,
    body: { subject: "A private ticket", customer: "Synthetic A", email: "a@example.test", body: "Only A may access this.", language: "en" },
  });
  assert.equal(created.response.status, 201);
  const ticketId = created.json.id;
  for (const body of [{ action: "reply", body: "cross tenant" }, { action: "update", status: "closed", priority: "high", assigned_to: "" }]) {
    assert.equal((await request(`/api/tickets/${ticketId}`, { cookie: b.cookie, body })).response.status, 404);
  }
  assert.equal((await request(`/api/tickets/${ticketId}`, { cookie: b.cookie, method: "GET" })).response.status, 404);
  const injectionSearch = await request("/api/tickets?q=' OR 1=1 --", { cookie: b.cookie, method: "GET" });
  assert.equal(injectionSearch.response.status, 200);
  assert.deepEqual(injectionSearch.json.tickets, []);
  const before = await request(`/api/tickets/${ticketId}`, { cookie: a.cookie, method: "GET" });
  assert.equal(before.json.messages.length, 1);

  const agentEmail = `${unique("agent")}@example.test`;
  const addAgent = await request("/api/team", {
    cookie: a.cookie,
    body: { name: "Security Agent", email: agentEmail, password: "security-test-1" },
  });
  assert.equal(addAgent.response.status, 201);
  const agentLogin = await request("/api/auth", { body: { action: "login", email: agentEmail, password: "security-test-1" } });
  assert.equal(agentLogin.response.status, 200);
  assert.equal((await request("/api/team", { cookie: agentLogin.cookie, body: { name: "Blocked", email: `${unique("blocked")}@example.test`, password: "security-test-1" } })).response.status, 403);
  assert.equal((await request("/api/settings", { cookie: agentLogin.cookie, body: { name: "Blocked", origin: base.origin } })).response.status, 403);

  const missingVersion = await request(`/api/tickets/${ticketId}`, { cookie: a.cookie, body: { action: "update", status: "closed", priority: "normal", assigned_to: "" } });
  assert.equal(missingVersion.response.status, 400);
  const close = await request(`/api/tickets/${ticketId}`, { cookie: a.cookie, body: { action: "update", status: "closed", priority: "normal", assigned_to: "", expectedVersion: before.json.ticket.version } });
  assert.equal(close.response.status, 200);
  assert.equal((await request(`/api/tickets/${ticketId}`, { cookie: a.cookie, body: { action: "reply", body: "blocked when closed" } })).response.status, 409);

  const xss = '<span data-security-marker="synthetic">escaped text</span>';
  const xssTicket = await request("/api/tickets", { cookie: a.cookie, body: { subject: xss, customer: "Synthetic A", email: "xss@example.test", body: xss, language: "en" } });
  assert.equal(xssTicket.response.status, 201);
  const rendered = await page(`/dashboard/tickets/${xssTicket.json.id}`, a.cookie);
  assert.equal(rendered.response.status, 200);
  assert.doesNotMatch(rendered.body, /<span data-security-marker="synthetic">escaped text<\/span>/);
  assert.match(rendered.body, /&lt;span data-security-marker=&quot;synthetic&quot;&gt;escaped text&lt;\/span&gt;/);

  const keyA = await widgetKey(a.cookie);
  const keyB = await widgetKey(b.cookie);
  const preflight = await request("/api/widget", { method: "OPTIONS", origin: base.origin });
  assert.equal(preflight.response.status, 204);
  assert.equal(preflight.response.headers.get("access-control-allow-origin"), base.origin);
  assert.equal((await request("/api/widget", { method: "GET", headers: { "X-Widget-Key": keyA } })).response.status, 401);
  const widget = await request("/api/widget", {
    headers: { "X-Widget-Key": keyA },
    body: { action: "create", subject: "Widget synthetic", customer: "Widget A", email: "widget@example.test", body: "Own conversation.", language: "en" },
  });
  assert.equal(widget.response.status, 201);
  const token = widget.json.conversationToken;
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal((await request("/api/widget", { method: "GET", headers: { "X-Widget-Key": keyA, "X-Conversation-Token": "0".repeat(64) } })).response.status, 404);
  assert.equal((await request("/api/widget", { method: "GET", headers: { "X-Widget-Key": keyB, "X-Conversation-Token": token } })).response.status, 404);
  const intentionalPublic = await request("/api/widget", { method: "GET", origin: null, headers: { "X-Widget-Key": keyA, "X-Conversation-Token": token } });
  assert.equal(intentionalPublic.response.status, 200);
  assert.equal(intentionalPublic.json.ticket.subject, "Widget synthetic");

  const logout = await request("/api/auth", { cookie: a.cookie, body: { action: "logout" } });
  assert.equal(logout.response.status, 200);
  assert.equal((await request("/api/tickets", { cookie: a.cookie, method: "GET" })).response.status, 401);
  t.diagnostic("Checks: auth absent/wrong password; malformed/oversized JSON; foreign Origin; tenant GET/reply/update and SQL-like search; agent role; closed reply; escaped inert HTML; widget preflight/tokens/cross-org/public own conversation; logout.");
});
