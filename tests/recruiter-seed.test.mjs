import assert from "node:assert/strict";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spawnSync } from "node:child_process";
import test from "node:test";

function runFixture(databasePath) {
  return spawnSync(process.execPath, ["scripts/seed.mjs", "--recruiter"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, DEMO_MODE: "true", DATABASE_PATH: databasePath },
  });
}

function passwordMatches(password, encoded) {
  const [salt, digest] = encoded.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(digest, "hex"),
  );
}

test("recruiter fixture is idempotent and preserves its credentials", () => {
  const directory = mkdtempSync(join(tmpdir(), "support-desk-recruiter-"));
  const databasePath = join(directory, "fixture.sqlite");
  try {
    assert.equal(runFixture(databasePath).status, 0);
    const first = new DatabaseSync(databasePath, { readOnly: true });
    const user = first
      .prepare("SELECT password_hash FROM users WHERE email=?")
      .get("recruiter@example.test");
    assert.ok(user);
    assert.equal(
      passwordMatches("SupportDeskDemo2026!", user.password_hash),
      true,
    );
    const counts = first
      .prepare(
        "SELECT (SELECT count(*) FROM tickets WHERE org_id='recruiter-demo') AS tickets,(SELECT count(*) FROM messages WHERE ticket_id LIKE 'recruiter-ticket-%') AS messages,(SELECT count(*) FROM events WHERE ticket_id LIKE 'recruiter-ticket-%') AS events",
      )
      .get();
    first.close();
    assert.deepEqual({ ...counts }, { tickets: 3, messages: 5, events: 5 });
    assert.equal(runFixture(databasePath).status, 0);
    const second = new DatabaseSync(databasePath, { readOnly: true });
    const repeatedUser = second
      .prepare("SELECT password_hash FROM users WHERE email=?")
      .get("recruiter@example.test");
    const repeatedCounts = second
      .prepare(
        "SELECT (SELECT count(*) FROM tickets WHERE org_id='recruiter-demo') AS tickets,(SELECT count(*) FROM messages WHERE ticket_id LIKE 'recruiter-ticket-%') AS messages,(SELECT count(*) FROM events WHERE ticket_id LIKE 'recruiter-ticket-%') AS events",
      )
      .get();
    second.close();
    assert.equal(repeatedUser.password_hash, user.password_hash);
    assert.deepEqual(
      { ...repeatedCounts },
      { tickets: 3, messages: 5, events: 5 },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("recruiter fixture rejects an existing reserved email", () => {
  const directory = mkdtempSync(
    join(tmpdir(), "support-desk-recruiter-conflict-"),
  );
  const databasePath = join(directory, "fixture.sqlite");
  try {
    const database = new DatabaseSync(databasePath);
    database.exec(
      readFileSync(new URL("../src/lib/schema.sql", import.meta.url), "utf8"),
    );
    database
      .prepare(
        "INSERT INTO organizations(id,name,widget_key,allowed_origin) VALUES (?,?,?,?)",
      )
      .run(
        "other-org",
        "Other",
        randomBytes(24).toString("hex"),
        "http://localhost:3010",
      );
    database
      .prepare(
        "INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES (?,?,?,?,?,?)",
      )
      .run(
        "other-user",
        "other-org",
        "Other",
        "recruiter@example.test",
        "not-used",
        "admin",
      );
    database.close();
    const result = runFixture(databasePath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Recruiter fixture conflict/);
    const verification = new DatabaseSync(databasePath, { readOnly: true });
    const user = verification
      .prepare("SELECT org_id FROM users WHERE email=?")
      .get("recruiter@example.test");
    verification.close();
    assert.deepEqual({ ...user }, { org_id: "other-org" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
