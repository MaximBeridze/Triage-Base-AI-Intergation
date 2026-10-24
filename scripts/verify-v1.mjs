import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3043"],
  { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
let logs = "";
child.stdout.on("data", (x) => (logs += x));
child.stderr.on("data", (x) => (logs += x));
const base = "http://127.0.0.1:3043";
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + "/api/config")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, logs);
  const source = JSON.parse(
      await readFile("data/support_tickets_500.json", "utf8"),
    ),
    rows = [];
  for (const id of [
    "TCK-10001",
    "TCK-10017",
    "TCK-10019",
    "TCK-10087",
    "TCK-10005",
  ]) {
    const ticket = source.find((t) => t.ticket_id === id);
    const response = await fetch(base + "/api/triage/v1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket: ticket.subject + "\n\n" + ticket.body }),
    });
    const result = await response.json();
    rows.push({ ticket_id: id, status: response.status, ...result });
    console.log(id, response.status, JSON.stringify(result));
    if (!response.ok) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  await writeFile(
    "output/v1-verification.json",
    JSON.stringify(
      { date: new Date().toISOString(), prompt_version: "triage-v1", rows },
      null,
      2,
    ),
  );
  assert.equal(rows.length, 5);
  assert.ok(
    rows.every((r) => r.status === 200 && typeof r.answer === "string"),
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  child.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 1000).unref();
}
