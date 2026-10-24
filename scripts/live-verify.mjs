import { spawn } from "node:child_process";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3042"],
  { env: process.env, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
child.stdout.on("data", (x) => (output += x));
child.stderr.on("data", (x) => (output += x));
const base = "http://127.0.0.1:3042";
const post = (route, body) =>
  fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  assert.ok(ready, output);
  const invalid = await post("/api/triage", { ticket: "" });
  assert.equal(invalid.status, 400);
  const datasets = await import("../data/support_tickets_500.json", {
    with: { type: "json" },
  });
  const hostile = datasets.default.find((t) => t.ticket_id === "TCK-10087");
  const injection = await post("/api/triage", {
    ticket: hostile.subject + "\n\n" + hostile.body,
  });
  const injectData = await injection.json();
  console.log("Injection test:", injection.status, JSON.stringify(injectData));
  async function run(dataset, count, model, replay) {
    const r = await post("/api/smoke", { dataset, count, model, replay });
    if (!r.ok) throw new Error("Smoke start status " + r.status);
    const text = await r.text();
    const events = text.trim().split("\n").map(JSON.parse);
    const last = events.at(-1);
    if (last.type !== "done")
      throw new Error("Run failed: " + JSON.stringify(last));
    console.log(
      "RUN",
      JSON.stringify({
        id: last.run.id,
        model: last.run.model,
        state: last.run.state,
        summary: last.run.summary,
      }),
    );
    return last.run;
  }
  const a = await run("labelled100", 5, "gemini-3.5-flash-lite");
  const b = await run("labelled100", 5, "gemini-3.1-flash-lite", a.id);
  const c = await run("tickets500", 1, "gemini-3.5-flash-lite");
  await mkdir("output", { recursive: true });
  await writeFile(
    "output/live-verification.json",
    JSON.stringify(
      {
        injection: { status: injection.status, ...injectData },
        runs: [a.id, b.id, c.id],
      },
      null,
      2,
    ),
  );
  console.log("Live verification saved.");
} catch (e) {
  console.error(e.message);
  console.error(output.slice(-1500));
  process.exitCode = 1;
} finally {
  child.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 1000).unref();
}
