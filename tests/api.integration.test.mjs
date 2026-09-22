import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const base = process.env.TEST_BASE_URL || "http://localhost:3011";
const databasePath = process.env.TEST_DATABASE_PATH;

if (process.env.TEST_MODE !== "true" || !databasePath) {
  throw new Error(
    "Refusing to run: set TEST_MODE=true and TEST_DATABASE_PATH to the disposable test SQLite file.",
  );
}

function unique(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function request(
  path,
  { cookie, origin = base, body, headers = {}, method = "POST" } = {},
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(origin ? { Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();
  return {
    response,
    json,
    cookie: response.headers.get("set-cookie")?.split(";", 1)[0],
  };
}

async function page(path, cookie) {
  const response = await fetch(`${base}${path}`, {
    headers: { Cookie: cookie },
  });
  return { response, body: await response.text() };
}

async function register(label) {
  const email = `${unique(label.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}@example.test`;
  const result = await request("/api/auth", {
    body: {
      action: "register",
      name: label,
      company: `${label} Corp`,
      email,
      password: "correct-horse-1",
    },
  });
  assert.equal(result.response.status, 200);
  assert.ok(result.cookie);
  return { email, cookie: result.cookie };
}

function database() {
  return new DatabaseSync(databasePath, { readOnly: true });
}

function organizationFor(email) {
  const connection = database();
  const row = connection
    .prepare(
      `SELECT o.id, o.widget_key, u.id AS user_id
    FROM users u JOIN organizations o ON o.id=u.org_id WHERE u.email=?`,
    )
    .get(email);
  connection.close();
  assert.ok(row, `missing test organization for ${email}`);
  return row;
}

function agentEmailFor(orgId) {
  const connection = database();
  const row = connection
    .prepare("SELECT email FROM users WHERE org_id=? AND role='agent'")
    .get(orgId);
  connection.close();
  assert.ok(row, `missing test agent for ${orgId}`);
  return row.email;
}

test(
  "API enforces organization, role, ticket, session, and widget boundaries",
  { concurrency: false },
  async () => {
    const a = await register("Organization A");
    const b = await register("Organization B");
    const orgA = organizationFor(a.email);
    const orgB = organizationFor(b.email);

    const wrongPassword = await request("/api/auth", {
      body: { action: "login", email: a.email, password: "wrong-password" },
    });
    assert.equal(wrongPassword.response.status, 401);
    const invalidTicket = await request("/api/tickets", {
      cookie: a.cookie,
      body: {
        subject: "",
        customer: "Ana",
        email: "ana@example.test",
        body: "help",
        language: "es",
      },
    });
    assert.equal(invalidTicket.response.status, 400);

    const created = await request("/api/tickets", {
      cookie: a.cookie,
      body: {
        subject: "Cobro duplicado",
        customer: "Ana",
        email: "ana@example.test",
        body: "Veo un cobro duplicado en mi factura.",
        language: "es",
      },
    });
    assert.equal(created.response.status, 201);
    const ticketId = created.json.id;
    assert.match(ticketId, /^[0-9a-f-]{36}$/);

    for (const path of [
      "/dashboard",
      "/dashboard/tickets",
      `/dashboard/tickets/${ticketId}`,
    ]) {
      const rendered = await page(path, a.cookie);
      assert.equal(rendered.response.status, 200);
      assert.doesNotMatch(
        rendered.body,
        /Only plain objects|Server Components error|Internal Server Error|Application error/i,
      );
    }

    const aList = await request("/api/tickets", {
      cookie: a.cookie,
      method: "GET",
    });
    assert.equal(aList.response.status, 200);
    assert.equal(aList.json.tickets.length, 1);
    const bList = await request("/api/tickets", {
      cookie: b.cookie,
      method: "GET",
    });
    assert.equal(bList.response.status, 200);
    assert.equal(bList.json.tickets.length, 0);
    assert.equal(
      (
        await request(`/api/tickets/${ticketId}`, {
          cookie: b.cookie,
          method: "GET",
        })
      ).response.status,
      404,
    );
    assert.equal(
      (
        await request(`/api/tickets/${ticketId}`, {
          cookie: b.cookie,
          body: { action: "reply", body: "cross-org" },
        })
      ).response.status,
      404,
    );
    const current = await request(`/api/tickets/${ticketId}`, {
      cookie: a.cookie,
      method: "GET",
    });
    assert.equal(current.response.status, 200);
    const originalVersion = current.json.ticket.version;

    const foreignAssignee = await request(`/api/tickets/${ticketId}`, {
      cookie: a.cookie,
      body: {
        action: "update",
        status: "pending",
        priority: "high",
        assigned_to: orgB.user_id,
        expectedVersion: originalVersion,
      },
    });
    assert.equal(foreignAssignee.response.status, 400);
    const close = await request(`/api/tickets/${ticketId}`, {
      cookie: a.cookie,
      body: {
        action: "update",
        status: "closed",
        priority: "normal",
        assigned_to: "",
        expectedVersion: originalVersion,
      },
    });
    assert.equal(close.response.status, 200);
    const stale = await request(`/api/tickets/${ticketId}`, {
      cookie: a.cookie,
      body: { action: "update", status: "open", priority: "normal", assigned_to: "", expectedVersion: originalVersion },
    });
    assert.equal(stale.response.status, 409);
    assert.equal(
      (
        await request(`/api/tickets/${ticketId}`, {
          cookie: a.cookie,
          body: { action: "reply", body: "not while closed" },
        })
      ).response.status,
      409,
    );
    assert.equal(
      (
        await request(`/api/tickets/${ticketId}`, {
          cookie: a.cookie,
          body: {
            action: "update",
            status: "open",
            priority: "normal",
            assigned_to: "",
            expectedVersion: close.json.ticket.version,
          },
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await request(`/api/tickets/${ticketId}`, {
          cookie: a.cookie,
          body: { action: "reply", body: "Ticket reopened." },
        })
      ).response.status,
      200,
    );

    const addAgent = await request("/api/team", {
      cookie: a.cookie,
      body: {
        name: "Agent A",
        email: `${unique("agent")}@example.test`,
        password: "correct-horse-1",
      },
    });
    assert.equal(addAgent.response.status, 201);
    const agentEmail = agentEmailFor(orgA.id);
    const agentLogin = await request("/api/auth", {
      body: { action: "login", email: agentEmail, password: "correct-horse-1" },
    });
    assert.equal(agentLogin.response.status, 200);
    assert.equal(
      (
        await request("/api/team", {
          cookie: agentLogin.cookie,
          body: {
            name: "Nope",
            email: `${unique("blocked")}@example.test`,
            password: "correct-horse-1",
          },
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await request("/api/settings", {
          cookie: agentLogin.cookie,
          body: { name: "Nope", origin: base },
        })
      ).response.status,
      403,
    );

    const setWidgetOrigin = await request("/api/settings", {
      cookie: a.cookie,
      body: { name: "Organization A", origin: "https://widget.example.test" },
    });
    assert.equal(setWidgetOrigin.response.status, 200);
    const setOtherWidgetOrigin = await request("/api/settings", {
      cookie: b.cookie,
      body: {
        name: "Organization B Corp",
        origin: "https://widget.example.test",
      },
    });
    assert.equal(setOtherWidgetOrigin.response.status, 200);
    const widgetHeaders = { "X-Widget-Key": orgA.widget_key };
    const widgetCreate = await request("/api/widget", {
      origin: "https://widget.example.test",
      headers: widgetHeaders,
      body: {
        action: "create",
        subject: "Widget help",
        customer: "Visitor",
        email: "visitor@example.test",
        body: "Need account help.",
        language: "en",
      },
    });
    assert.equal(widgetCreate.response.status, 201);
    assert.equal(
      widgetCreate.response.headers.get("access-control-allow-origin"),
      "https://widget.example.test",
    );
    const conversationToken = widgetCreate.json.conversationToken;
    assert.match(conversationToken, /^[a-f0-9]{64}$/);
    const conversationHeaders = {
      ...widgetHeaders,
      "X-Conversation-Token": conversationToken,
    };
    assert.equal(
      (
        await request("/api/widget", {
          origin: "https://widget.example.test",
          headers: conversationHeaders,
          method: "GET",
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await request("/api/widget", {
          origin: "https://widget.example.test",
          headers: conversationHeaders,
          body: { action: "message", body: "More detail." },
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await request("/api/widget", {
          origin: "https://evil.example.test",
          headers: conversationHeaders,
          method: "GET",
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await request("/api/widget", {
          origin: "https://widget.example.test",
          headers: {
            "X-Widget-Key": orgB.widget_key,
            "X-Conversation-Token": conversationToken,
          },
          method: "GET",
        })
      ).response.status,
      404,
    );
    assert.equal(
      (
        await request("/api/widget", {
          origin: "https://widget.example.test",
          headers: widgetHeaders,
          body: {
            action: "create",
            subject: "",
            customer: "Visitor",
            email: "visitor@example.test",
            body: "x",
            language: "en",
          },
        })
      ).response.status,
      400,
    );
    let rateAbuse;
    for (let attempt = 0; attempt < 29; attempt += 1) {
      rateAbuse = await request("/api/widget", {
        origin: "https://widget.example.test",
        headers: widgetHeaders,
        body: { action: "invalid" },
      });
    }
    assert.equal(rateAbuse.response.status, 429);

    const logout = await request("/api/auth", {
      cookie: a.cookie,
      body: { action: "logout" },
    });
    assert.equal(logout.response.status, 200);
    assert.equal(
      (await request("/api/tickets", { cookie: a.cookie, method: "GET" }))
        .response.status,
      401,
    );
  },
);
