import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

const directory = mkdtempSync(join(tmpdir(), "support-desk-integration-"));
const databasePath = join(directory, "support.sqlite");
if (!directory.startsWith(join(tmpdir(), "support-desk-integration-")))
  throw new Error("Unexpected temporary integration directory.");
const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const address = probe.address();
    probe.close((error) => (error ? reject(error) : resolve(String(address.port))));
  });
});
const base = `http://127.0.0.1:${port}`;
const shared = {
  ...process.env,
  APP_ORIGIN: base,
  DATABASE_PATH: databasePath,
  TEST_MODE: "true",
  TEST_DATABASE_PATH: databasePath,
  TEST_BASE_URL: base,
};
let server;

function run(command, args, env = shared) {
  const result = spawnSync(command, args, { cwd: process.cwd(), env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

async function start(demoMode) {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], {
    cwd: process.cwd(),
    env: { ...shared, DEMO_MODE: demoMode ? "true" : "false" },
    stdio: "inherit",
  });
  let exited = false;
  server.once("exit", () => { exited = true; });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (exited) throw new Error("Isolated Next server exited during startup.");
    try {
      const response = await fetch(base);
      if (response.ok || response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for isolated Next server.");
}

async function stop() {
  if (!server) return;
  const child = server;
  server = undefined;
  if (child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

try {
  run(process.execPath, ["scripts/seed.mjs", "--recruiter"], { ...shared, DEMO_MODE: "true" });
  await start(false);
  run(process.execPath, ["--test", "tests/demo-reset.test.mjs"], { ...shared, RESET_EXPECT_DISABLED: "true" });
  await stop();
  await start(true);
  run(process.execPath, ["--test", "tests/preferences.integration.test.mjs"]);
  run(process.execPath, ["--test", "tests/profile.integration.test.mjs"]);
  run(process.execPath, ["--test", "tests/api.integration.test.mjs"]);
  run(process.execPath, ["--test", "tests/operational.integration.test.mjs"]);
  run(process.execPath, ["--test", "tests/api-security.test.mjs"]);
  run(process.execPath, ["--test", "tests/demo-reset.test.mjs"]);
} finally {
  await stop();
  rmSync(directory, { recursive: true, force: true });
}
