import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const model = "@cf/cloudflare/clef-flash",
  base = "http://127.0.0.1:3042";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--port", "3042"],
  {
    env: { ...process.env, SMOKE_DELAY_MS: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (x) => (output += x));
child.stderr.on("data", (x) => (output += x));
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
  const tickets = JSON.parse(
    await readFile("data/support_tickets_500.json", "utf8"),
  );
  const ticket = tickets.find((t) => t.ticket_id === "TCK-10087");
  const injection = await post("/api/triage", {
    ticket: ticket.subject + "\n\n" + ticket.body,
    model,
  });
  const result = await injection.json();
  console.log("Injection", injection.status, JSON.stringify(result));
  assert.equal(injection.status, 200);
  async function run(count, replay) {
    const response = await post("/api/smoke", {
      dataset: "labelled100",
      count,
      model,
      replay,
    });
    assert.equal(response.status, 200);
    const events = (await response.text()).trim().split("\n").map(JSON.parse);
    const last = events.at(-1);
    assert.equal(last.type, "done");
    console.log(
      "Clef run",
      JSON.stringify({
        id: last.run.id,
        state: last.run.state,
        summary: last.run.summary,
      }),
    );
    return last.run;
  }
  const comparison = await run(5, "19f9373c-caa3-4a60-af38-20038dceafee");
  const full = await run(100);
  await mkdir("output", { recursive: true });
  await writeFile(
    "output/decision-verification.json",
    JSON.stringify(
      {
        date: new Date().toISOString(),
        model,
        injection: { status: injection.status, ...result },
        baseline: "19f9373c-caa3-4a60-af38-20038dceafee",
        comparison: comparison.id,
        dev_set: full.id,
        cost_basis:
          "Published list price, USD per million input tokens = " +
          process.env.CLOUDFLARE_INPUT_PRICE_PER_MILLION +
          "; free allowance not deducted.",
      },
      null,
      2,
    ),
  );
} catch (e) {
  console.error(e.message);
  console.error(output.slice(-1500));
  process.exitCode = 1;
} finally {
  child.kill();
  setTimeout(() => process.exit(process.exitCode || 0), 1000).unref();
}
