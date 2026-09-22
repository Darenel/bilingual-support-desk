function column(connection, table, name) {
  return connection.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === name);
}

function table(connection, name) {
  return connection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

export function migrate(connection) {
  for (const [name, sql] of [
    ["version", "ALTER TABLE tickets ADD COLUMN version INTEGER NOT NULL DEFAULT 1"],
    ["first_response_at", "ALTER TABLE tickets ADD COLUMN first_response_at TEXT"],
    ["first_response_sla_hours", "ALTER TABLE tickets ADD COLUMN first_response_sla_hours INTEGER"],
    ["closed_at", "ALTER TABLE tickets ADD COLUMN closed_at TEXT"],
  ]) if (!column(connection, "tickets", name)) connection.exec(sql);
  if (table(connection, "users")) {
    if (!column(connection, "users", "first_name")) connection.exec("ALTER TABLE users ADD COLUMN first_name TEXT");
    if (!column(connection, "users", "last_name")) connection.exec("ALTER TABLE users ADD COLUMN last_name TEXT NOT NULL DEFAULT ''");
    if (!column(connection, "users", "username")) connection.exec("ALTER TABLE users ADD COLUMN username TEXT");
    connection.exec("UPDATE users SET first_name=name WHERE first_name IS NULL OR first_name='' ");
    connection.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci ON users(lower(username)) WHERE username IS NOT NULL");
    connection.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci ON users(lower(email))");
  }
  connection.exec("CREATE TABLE IF NOT EXISTS org_revisions (org_id TEXT PRIMARY KEY REFERENCES organizations(id), revision INTEGER NOT NULL DEFAULT 0)");
  connection.exec("UPDATE tickets SET first_response_at=(SELECT MIN(created_at) FROM messages WHERE ticket_id=tickets.id AND kind='agent') WHERE first_response_at IS NULL AND EXISTS (SELECT 1 FROM messages WHERE ticket_id=tickets.id AND kind='agent')");
  connection.exec("UPDATE tickets SET first_response_sla_hours=CASE priority WHEN 'high' THEN 1 ELSE 4 END WHERE first_response_at IS NOT NULL AND first_response_sla_hours IS NULL");
}
