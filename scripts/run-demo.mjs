// Regenerates examples/report by profiling the fictional demo site end to end.
// Usage: npm run build && npm run demo            (offline rules)
//        ANTHROPIC_API_KEY=... npm run demo -- --llm   (Claude synthesis)

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { start } from "../examples/demo-site/server.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 4173);
const base = `http://localhost:${port}`;
const useLlm = process.argv.includes("--llm");

const server = await start(port);
const args = [
  join(root, "cli/bin/outside-in.js"),
  `localhost:${port}`,
  "--out", join(root, "examples/report"),
  "--wayback-base", `${base}/__wayback`,
  "--doh", `${base}/__doh`,
  "--appstore-base", `${base}/__appstore`,
  "--app-id", "1234567890",
  "--delay", "250",
  ...(useLlm ? [] : ["--no-llm"]),
];

const code = await new Promise((resolve) => {
  spawn(process.execPath, args, { stdio: "inherit" }).on("exit", resolve);
});
server.close();
process.exit(code ?? 1);
