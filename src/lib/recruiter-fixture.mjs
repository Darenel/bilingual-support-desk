export const recruiterFixture = {
  organization: { id: "recruiter-demo", name: "Bilingual Support Desk Demo" },
  admin: {
    id: "recruiter-admin",
    name: "Recruiter Demo Admin",
    email: "recruiter@example.test",
  },
  tickets: [
    {
      id: "recruiter-ticket-1",
      subject: "Invoice question",
      language: "en",
      status: "open",
      priority: "high",
      reply: null,
    },
    {
      id: "recruiter-ticket-2",
      subject: "Acceso a la cuenta",
      language: "es",
      status: "pending",
      priority: "high",
      reply: "Revisamos el acceso y te avisamos hoy.",
    },
    {
      id: "recruiter-ticket-3",
      subject: "Address updated",
      language: "en",
      status: "closed",
      priority: "normal",
      reply: "Your billing address is updated.",
    },
  ],
};

function assertReservedFixture(connection) {
  const organization = connection
    .prepare("SELECT id,name FROM organizations WHERE id=?")
    .get(recruiterFixture.organization.id);
  const admin = connection
    .prepare("SELECT id,org_id,email,role FROM users WHERE id=?")
    .get(recruiterFixture.admin.id);
  if (
    !organization ||
    organization.name !== recruiterFixture.organization.name ||
    !admin ||
    admin.org_id !== recruiterFixture.organization.id ||
    admin.email !== recruiterFixture.admin.email ||
    admin.role !== "admin"
  ) {
    throw new Error("Recruiter fixture is incomplete or reserved identifiers conflict.");
  }
}

export function resetRecruiterFixture(connection) {
  assertReservedFixture(connection);
  const now = Date.now();
  const created = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const replied = new Date(now - 90 * 60 * 1000).toISOString();
  const closed = new Date(now - 30 * 60 * 1000).toISOString();

  connection.exec("BEGIN IMMEDIATE");
  try {
    const orgId = recruiterFixture.organization.id;
    const version =
      Number(
        connection
          .prepare("SELECT COALESCE(MAX(version),0) AS value FROM tickets WHERE org_id=?")
          .get(orgId).value,
      ) + 1;
    connection
      .prepare("DELETE FROM events WHERE ticket_id IN (SELECT id FROM tickets WHERE org_id=?)")
      .run(orgId);
    connection
      .prepare("DELETE FROM messages WHERE ticket_id IN (SELECT id FROM tickets WHERE org_id=?)")
      .run(orgId);
    connection.prepare("DELETE FROM tickets WHERE org_id=?").run(orgId);

    for (const ticket of recruiterFixture.tickets) {
      const firstResponse = ticket.reply ? replied : null;
      const closedAt = ticket.status === "closed" ? closed : null;
      connection
        .prepare(
          "INSERT INTO tickets(id,org_id,subject,customer,email,language,status,priority,assigned_to,version,first_response_at,first_response_sla_hours,closed_at,created_at,updated_at) VALUES (?,?,?,'Recruiter Visitor','visitor@example.test',?,?,?,'recruiter-admin',?,?,?,?,?,?)",
        )
        .run(
          ticket.id,
          orgId,
          ticket.subject,
          ticket.language,
          ticket.status,
          ticket.priority,
          version,
          firstResponse,
          firstResponse ? (ticket.priority === "high" ? 1 : 4) : null,
          closedAt,
          created,
          closedAt || firstResponse || created,
        );
      connection
        .prepare("INSERT INTO messages(id,ticket_id,author,kind,body,created_at) VALUES (?,?, 'Recruiter Visitor','customer','Fixture message',?)")
        .run(`${ticket.id}-customer`, ticket.id, created);
      connection
        .prepare("INSERT INTO events(ticket_id,actor,action,created_at) VALUES (?, 'Recruiter Visitor','Ticket creado',?)")
        .run(ticket.id, created);
      if (ticket.reply) {
        connection
          .prepare("INSERT INTO messages(id,ticket_id,author,kind,body,created_at) VALUES (?,?, 'Recruiter Demo Admin','agent',?,?)")
          .run(`${ticket.id}-reply`, ticket.id, ticket.reply, firstResponse);
        connection
          .prepare("INSERT INTO events(ticket_id,actor,action,created_at) VALUES (?, 'Recruiter Demo Admin','Respuesta del equipo',?)")
          .run(ticket.id, firstResponse);
      }
    }
    connection
      .prepare("INSERT INTO org_revisions(org_id,revision) VALUES (?,1) ON CONFLICT(org_id) DO UPDATE SET revision=revision+1")
      .run(orgId);
    connection.exec("COMMIT");
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}
