import { spawn } from "node:child_process";

const python = process.env.PYTHON || "python";
const analyzerReady = await fetch("http://127.0.0.1:8001/health")
  .then((response) => response.ok)
  .catch(() => false);
const analyzer = analyzerReady
  ? null
  : spawn(python, ["python-service/analyzer.py"], { stdio: "inherit" });
const next = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev", "--", ...process.argv.slice(2)],
  { stdio: "inherit" },
);
const processes = [next, ...(analyzer ? [analyzer] : [])];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill();
  process.exitCode = code;
};
for (const child of processes) {
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.once("exit", (code) => stop(code ?? 1));
}
process.once("SIGINT", () => stop());
process.once("SIGTERM", () => stop());
