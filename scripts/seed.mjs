import { DatabaseSync } from "node:sqlite";
import { randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { migrate } from "../src/lib/migrate.mjs";
import { resetRecruiterFixture } from "../src/lib/recruiter-fixture.mjs";

if (process.env.DEMO_MODE !== "true") {
  console.error("Set DEMO_MODE=true to seed local demo data.");
  process.exit(1);
}

const file = resolve(process.env.DATABASE_PATH || "data/support.sqlite");
mkdirSync(dirname(file), { recursive: true });
const db = new DatabaseSync(file);
db.exec(
  readFileSync(new URL("../src/lib/schema.sql", import.meta.url), "utf8"),
);
migrate(db);

const hashPassword = (value) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(value, salt, 64).toString("hex")}`;
};
const origin = process.env.APP_ORIGIN || "http://localhost:3010";

function insertLocalDemo() {
  const password =
    process.env.DEMO_PASSWORD || randomBytes(12).toString("base64url");
  const existingAdmin = Boolean(
    db.prepare("SELECT id FROM users WHERE id=?").get("demo-admin"),
  );
  const organizations = [
    [
      "demo-acme",
      "Acme Demo",
      process.env.DEMO_WIDGET_KEY || randomBytes(24).toString("hex"),
    ],
    ["demo-northwind", "Northwind Demo", randomBytes(24).toString("hex")],
  ];
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [id, name, widgetKey] of organizations) {
      db.prepare(
        "INSERT OR IGNORE INTO organizations(id,name,widget_key,allowed_origin) VALUES (?,?,?,?)",
      ).run(id, name, widgetKey, origin);
    }
    for (const [id, org, name, email, role] of [
      ["demo-admin", "demo-acme", "Demo Admin", "admin@example.test", "admin"],
      ["demo-agent", "demo-acme", "Demo Agent", "agent@example.test", "agent"],
      [
        "northwind-admin",
        "demo-northwind",
        "Northwind Admin",
        "northwind@example.test",
        "admin",
      ],
    ]) {
      db.prepare(
        "INSERT OR IGNORE INTO users(id,org_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)",
      ).run(id, org, name, email, hashPassword(password), role);
    }
    for (const [
      id,
      subject,
      customer,
      email,
      language,
      status,
      priority,
      body,
    ] of [
      [
        "demo-ticket-1",
        "No puedo iniciar sesion",
        "Maria Torres",
        "maria@example.test",
        "es",
        "open",
        "high",
        "No recibi el correo para restablecer mi contrasena.",
      ],
      [
        "demo-ticket-2",
        "Invoice copy request",
        "Jordan Lee",
        "jordan@example.test",
        "en",
        "pending",
        "normal",
        "Could you send a copy of the invoice for September?",
      ],
      [
        "demo-ticket-3",
        "Actualizar datos de facturacion",
        "Luis Ramos",
        "luis@example.test",
        "es",
        "closed",
        "normal",
        "Necesito cambiar el correo de facturacion.",
      ],
    ]) {
      db.prepare(
        "INSERT OR IGNORE INTO tickets(id,org_id,subject,customer,email,language,status,priority,assigned_to) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        "demo-acme",
        subject,
        customer,
        email,
        language,
        status,
        priority,
        "demo-agent",
      );
      db.prepare(
        "INSERT OR IGNORE INTO messages(id,ticket_id,author,kind,body) VALUES (?,?,?,?,?)",
      ).run(`${id}-message`, id, customer, "customer", body);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const savedKey = db
    .prepare("SELECT widget_key FROM organizations WHERE id=?")
    .get("demo-acme").widget_key;
  console.log(
    existingAdmin
      ? "Existing demo users were left unchanged; use their existing password."
      : `Demo users: admin@example.test and agent@example.test; password: ${password}`,
  );
  console.log(`Widget key: ${savedKey}; allowed origin: ${origin}`);
}

function conflict(message) {
  throw new Error(`Recruiter fixture conflict: ${message}`);
}

function insertRecruiterFixture() {
  const organization = {
    id: "recruiter-demo",
    name: "Bilingual Support Desk Demo",
  };
  const admin = {
    id: "recruiter-admin",
    name: "Recruiter Demo Admin",
    email: "recruiter@example.test",
    password: "SupportDeskDemo2026!",
  };
  const tickets = [
    [
      "recruiter-ticket-1",
      "Invoice question",
      "Taylor Brooks",
      "taylor@example.test",
      "en",
      "open",
      "normal",
      "Can I receive a copy of my invoice?",
      "We will send it today.",
    ],
    [
      "recruiter-ticket-2",
      "Acceso a la cuenta",
      "Sofia Mendez",
      "sofia@example.test",
      "es",
      "pending",
      "high",
      "No puedo acceder a mi cuenta desde ayer.",
      "Revisamos el acceso y te avisamos hoy.",
    ],
    [
      "recruiter-ticket-3",
      "Address updated",
      "Morgan Reed",
      "morgan@example.test",
      "en",
      "closed",
      "normal",
      "I need to update my billing address.",
      "Your billing address is updated.",
    ],
  ];
  const existingOrganization = db
    .prepare("SELECT id,name FROM organizations WHERE id=?")
    .get(organization.id);
  const existingAdmin = db
    .prepare("SELECT id,org_id,email,role FROM users WHERE id=? OR email=?")
    .all(admin.id, admin.email);
  if (existingOrganization && existingOrganization.name !== organization.name)
    conflict("reserved organization id is already in use");
  if (
    existingAdmin.some(
      (user) =>
        user.id !== admin.id ||
        user.org_id !== organization.id ||
        user.email !== admin.email ||
        user.role !== "admin",
    )
  )
    conflict("reserved administrator id or email is already in use");
  if (Boolean(existingOrganization) !== Boolean(existingAdmin.length))
    conflict("reserved organization or administrator is incomplete");
  for (const [id] of tickets) {
    const ticket = db.prepare("SELECT org_id FROM tickets WHERE id=?").get(id);
    if (ticket && ticket.org_id !== organization.id)
      conflict(`ticket id ${id} is already in use`);
    for (const messageId of [`${id}-customer`, `${id}-reply`]) {
      const message = db
        .prepare("SELECT ticket_id FROM messages WHERE id=?")
        .get(messageId);
      if (message && message.ticket_id !== id)
        conflict(`message id ${messageId} is already in use`);
    }
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    if (!existingOrganization) {
      db.prepare(
        "INSERT INTO organizations(id,name,widget_key,allowed_origin) VALUES (?,?,?,?)",
      ).run(
        organization.id,
        organization.name,
        randomBytes(24).toString("hex"),
        origin,
      );
      db.prepare(
        "INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)",
      ).run(
        admin.id,
        organization.id,
        admin.name,
        admin.email,
        hashPassword(admin.password),
        "admin",
      );
    }
    for (const [
      id,
      subject,
      customer,
      email,
      language,
      status,
      priority,
      body,
      response,
    ] of tickets) {
      db.prepare(
        "INSERT OR IGNORE INTO tickets(id,org_id,subject,customer,email,language,status,priority,assigned_to) VALUES (?,?,?,?,?,?,?,?,?)",
      ).run(
        id,
        organization.id,
        subject,
        customer,
        email,
        language,
        status,
        priority,
        admin.id,
      );
      db.prepare(
        "INSERT OR IGNORE INTO messages(id,ticket_id,author,kind,body) VALUES (?,?,?,?,?)",
      ).run(`${id}-customer`, id, customer, "customer", body);
      db.prepare(
        "INSERT OR IGNORE INTO messages(id,ticket_id,author,kind,body) VALUES (?,?,?,?,?)",
      ).run(`${id}-reply`, id, admin.name, "agent", response);
      db.prepare(
        "INSERT INTO events(ticket_id,actor,action) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM events WHERE ticket_id=? AND action=?)",
      ).run(id, customer, "Ticket creado", id, "Ticket creado");
      db.prepare(
        "INSERT INTO events(ticket_id,actor,action) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM events WHERE ticket_id=? AND action=?)",
      ).run(id, admin.name, "Respuesta del equipo", id, "Respuesta del equipo");
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  resetRecruiterFixture(db);
  console.log(
    existingOrganization
      ? "Recruiter fixture was left unchanged; use its existing password."
      : `Recruiter fixture ready: ${admin.email} / ${admin.password}`,
  );
}

if (process.argv.includes("--recruiter")) insertRecruiterFixture();
else insertLocalDemo();
