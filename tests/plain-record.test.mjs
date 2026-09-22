import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { plainRecord } from "../src/lib/plain.mjs";

test("normalizes SQLite records before a client prop boundary", () => {
  const database = new DatabaseSync(":memory:");
  const row = database.prepare("SELECT 'Ada' AS name").get();
  const record = plainRecord(row);
  database.close();

  assert.equal(Object.getPrototypeOf(row), null);
  assert.equal(Object.getPrototypeOf(record), Object.prototype);
  assert.deepEqual(record, { name: "Ada" });
});
