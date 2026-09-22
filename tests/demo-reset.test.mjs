import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const base = process.env.TEST_BASE_URL;
const databasePath = process.env.TEST_DATABASE_PATH;

if (
  process.env.TEST_MODE !== "true" ||
  !databasePath ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
) {
  throw new Error("Use TEST_MODE=true with a disposable loopback database.");
}

async function request(path, { body, cookie, origin = base } = {}) {
  const response = await fetch(new URL(path, base), {
    method: "POST",
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    json: text ? JSON.parse(text) : null,
    cookie: response.headers.get("set-cookie")?.split(";", 1)[0],
  };
}

async function login(email, password) {
  const result = await request("/api/auth", {
    body: { action: "login", email, password },
  });
  assert.equal(result.response.status, 200);
  assert.ok(result.cookie);
  return result.cookie;
}

async function getTicket(id, cookie) {
  const response = await fetch(new URL(`/api/tickets/${id}`, base), {
    headers: { Cookie: cookie },
  });
  return { response, json: await response.json() };
}

function counts(orgId) {
  const connection = new DatabaseSync(databasePath, { readOnly: true });
  const row = connection
    .prepare(
      `SELECT
        (SELECT count(*) FROM tickets WHERE org_id=?) AS tickets,
        (SELECT count(*) FROM messages m JOIN tickets t ON t.id=m.ticket_id WHERE t.org_id=?) AS messages,
        (SELECT count(*) FROM events e JOIN tickets t ON t.id=e.ticket_id WHERE t.org_id=?) AS events`,
    )
    .get(orgId, orgId, orgId);
  connection.close();
  return { ...row };
}

function outsiderOrgId() {
  const connection = new DatabaseSync(databasePath, { readOnly: true });
  const row = connection
    .prepare("SELECT org_id FROM users WHERE email LIKE 'reset-outsider-%@example.test' ORDER BY rowid DESC LIMIT 1")
    .get();
  connection.close();
  return row.org_id;
}

test("demo reset is gated and never changes another organization or fixture credentials", { concurrency: false }, async () => {
  const recruiter = await login("recruiter@example.test", "SupportDeskDemo2026!");

  if (process.env.RESET_EXPECT_DISABLED === "true") {
    const disabled = await request("/api/demo/reset", { body: {}, cookie: recruiter });
    assert.equal(disabled.response.status, 404);
    return;
  }

  const other = await request("/api/auth", {
    body: {
      action: "register",
      name: "Reset outsider",
      company: "Untouched organization",
      email: `reset-outsider-${Date.now()}@example.test`,
      password: "security-test-1",
    },
  });
  assert.equal(other.response.status, 200);
  const previousFixture = await getTicket("recruiter-ticket-1", recruiter);
  assert.equal(previousFixture.response.status, 200);
  const temporaryDemoTicket = await request("/api/tickets", {
    cookie: recruiter,
    body: { subject: "Discard at reset", customer: "Demo visitor", email: "demo@example.test", body: "Temporary fixture mutation.", language: "en" },
  });
  assert.equal(temporaryDemoTicket.response.status, 201);
  const otherTicket = await request("/api/tickets", {
    cookie: other.cookie,
    body: {
      subject: "Keep this ticket",
      customer: "Other visitor",
      email: "other@example.test",
      body: "This data belongs to another organization.",
      language: "en",
    },
  });
  assert.equal(otherTicket.response.status, 201);
  const foreign = await request("/api/demo/reset", { body: {}, cookie: other.cookie });
  assert.equal(foreign.response.status, 403);
  assert.equal(
    (await request("/api/demo/reset", { body: {}, cookie: recruiter, origin: "https://unsafe.example.test" })).response.status,
    403,
  );

  const otherOrgId = outsiderOrgId();
  const beforeOther = counts(otherOrgId);
  const connection = new DatabaseSync(databasePath, { readOnly: true });
  const passwordHash = connection.prepare("SELECT password_hash FROM users WHERE id='recruiter-admin'").get().password_hash;
  connection.close();
  const reset = await request("/api/demo/reset", { body: {}, cookie: recruiter });
  assert.equal(reset.response.status, 200);
  assert.equal(reset.json.reset, true);
  assert.deepEqual({ tickets: reset.json.tickets, messages: reset.json.messages, events: reset.json.events }, counts("recruiter-demo"));
  assert.equal(reset.json.tickets, 3);
  assert.ok(reset.json.messages >= 3);
  assert.ok(reset.json.events >= 3);
  assert.equal((await getTicket(temporaryDemoTicket.json.id, recruiter)).response.status, 404);
  const stale = await request(`/api/tickets/recruiter-ticket-1`, {
    cookie: recruiter,
    body: { action: "update", status: "pending", priority: "high", assigned_to: "", expectedVersion: previousFixture.json.ticket.version },
  });
  assert.equal(stale.response.status, 409);
  const repeated = await request("/api/demo/reset", { body: {}, cookie: recruiter });
  assert.equal(repeated.response.status, 200);
  assert.deepEqual({ tickets: repeated.json.tickets, messages: repeated.json.messages, events: repeated.json.events }, counts("recruiter-demo"));
  assert.deepEqual(counts(otherOrgId), beforeOther);
  const after = new DatabaseSync(databasePath, { readOnly: true });
  assert.equal(after.prepare("SELECT password_hash FROM users WHERE id='recruiter-admin'").get().password_hash, passwordHash);
  after.close();
});
