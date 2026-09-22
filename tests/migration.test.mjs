import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { migrate } from "../src/lib/migrate.mjs";

test("migration preserves legacy tickets and is repeat-safe", () => {
  const directory = mkdtempSync(join(tmpdir(), "support-migration-"));
  const path = join(directory, "legacy.sqlite");
  try {
    const database = new DatabaseSync(path);
    database.exec("CREATE TABLE organizations (id TEXT PRIMARY KEY); CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL); CREATE TABLE tickets (id TEXT PRIMARY KEY, priority TEXT, first_response_at TEXT); CREATE TABLE messages (ticket_id TEXT, kind TEXT, created_at TEXT); INSERT INTO organizations VALUES ('org'); INSERT INTO users VALUES ('user','Legacy Name','legacy@example.test'); INSERT INTO tickets VALUES ('ticket','high',NULL); INSERT INTO messages VALUES ('ticket','agent','2026-01-01T00:00:00.000Z')");
    migrate(database);
    migrate(database);
    const ticket = database.prepare("SELECT id,version,first_response_at,first_response_sla_hours,closed_at FROM tickets WHERE id='ticket'").get();
    assert.deepEqual({ ...ticket }, { id: "ticket", version: 1, first_response_at: "2026-01-01T00:00:00.000Z", first_response_sla_hours: 1, closed_at: null });
    assert.equal(database.prepare("SELECT count(*) AS total FROM org_revisions").get().total, 0);
    assert.deepEqual({ ...database.prepare("SELECT first_name,last_name,username FROM users WHERE id='user'").get() }, { first_name: "Legacy Name", last_name: "", username: null });
    database.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
