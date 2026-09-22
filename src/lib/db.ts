import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { migrate } from "./migrate.mjs";

let instance: DatabaseSync | undefined;
export function db() {
  if (instance) return instance;
  const path = resolve(
    /* turbopackIgnore: true */ process.env.DATABASE_PATH ||
      "data/support.sqlite",
  );
  mkdirSync(dirname(path), { recursive: true });
  instance = new DatabaseSync(path);
  instance.exec(
    readFileSync(
      resolve(/* turbopackIgnore: true */ process.cwd(), "src/lib/schema.sql"),
      "utf8",
    ),
  );
  migrate(instance);
  return instance;
}

export function transaction<T>(operation: () => T): T {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try {
    const value = operation();
    connection.exec("COMMIT");
    return value;
  } catch (error) {
    connection.exec("ROLLBACK");
    throw error;
  }
}
