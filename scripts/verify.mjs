import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
let mode = "ok",
  calls = 0;
const valid = {
  category: "technical_bug",
  priority: "low",
  summary: "A display issue.",
  suggested_action: "Check rendering.",
};
const mock = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  const input = JSON.parse(body);
  calls++;
  if (req.url.includes("/accounts/")) {
    assert.equal(req.headers.authorization, "Bearer test-cf-token");
    assert.equal(input.model, "clef-flash");
    assert.equal(input.questions.category.type, "choice");
    assert.ok(!("messages" in input));
    res.setHeader("Content-Type", "application/json");
    if (mode === "cf-quota") {
      res.writeHead(429);
      res.end("{}");
      return;
    }
    if (mode === "cf-auth") {
      res.writeHead(403);
      res.end('{"secret":"provider-private"}');
      return;
    }
    if (mode === "cf-invalid-json") {
      res.end("not json");
      return;
    }
    res.end(
      JSON.stringify({
        success: true,
        result: {
          model: "clef-flash",
          answers: {
            category: {
              type: "choice",
              choice: mode === "cf-invalid" ? "invented" : "technical_bug",
              probabilities: {
                billing: 0.1,
                technical_bug: mode === "cf-inconsistent" ? 0.1 : 0.7,
                account: 0.1,
                feature_request: 0.1,
              },
            },
            priority: {
              type: "choice",
              choice: "low",
              probabilities: { low: 0.8, medium: 0.1, high: 0.1 },
            },
          },
          usage: { input_tokens: 100, output_tokens: 0 },
        },
      }),
    );
    return;
  }
  assert.equal(req.headers.authorization, "Bearer test-key");
  assert.ok(input.messages[0].role === "system");
  res.setHeader("Content-Type", "application/json");
  if (mode === "quota") {
    res.writeHead(429);
    res.end(
      JSON.stringify({
        error: { message: "private provider detail", type: "rate_limit" },
      }),
    );
    return;
  }
  if (mode === "wrong-model") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: { message: "private provider detail" } }));
    return;
  }
  const content =
    mode === "invalid" || (mode === "retry" && calls % 2 === 1)
      ? '{"category":"invented"}'
      : JSON.stringify(valid);
  res.end(
    JSON.stringify({
      id: "mock",
      object: "chat.completion",
      model: input.model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: mode === "length" ? "length" : "stop",
        },
      ],
      usage: { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
    }),
  );
});
await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
const mockPort = mock.address().port,
  appPort = 3041;
const storage = await mkdtemp(path.join(process.cwd(), "tmp-tests-"));
// Next dev regenerates type paths for the isolated build directory.
const typeConfigBackups = await Promise.all(
  ["next-env.d.ts", "tsconfig.json"].map(async (name) => [
    name,
    await readFile(name),
  ]),
);
let output = "";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", String(appPort)],
  {
    env: {
      ...process.env,
      NEXT_BUILD_DIR: ".next-verification",
      TRIAGE_STORAGE_DIR: storage,
      LLM_BASE_URL: `http://127.0.0.1:${mockPort}/v1/`,
      LLM_API_KEY: "test-key",
      LLM_MODEL: "test-model",
      LLM_MODELS: "test-model,test-model-2",
      LLM_STRUCTURED_OUTPUT: "json_schema",
      LLM_INPUT_PRICE_PER_MILLION: "0",
      LLM_OUTPUT_PRICE_PER_MILLION: "0",
      SMOKE_DELAY_MS: "0",
      CLOUDFLARE_ACCOUNT_ID: "test-account",
      CLOUDFLARE_API_TOKEN: "test-cf-token",
      CLOUDFLARE_API_BASE: `http://127.0.0.1:${mockPort}/v4`,
      CLOUDFLARE_INPUT_PRICE_PER_MILLION: "0.038",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
child.stdout.on("data", (x) => (output += x));
child.stderr.on("data", (x) => (output += x));
const base = `http://127.0.0.1:${appPort}`;
async function post(route, body) {
  return fetch(base + route, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function checkStatus(body, status) {
  const r = await post("/api/triage", body);
  assert.equal(r.status, status, await r.text());
}
try {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(base + "/api/config")).ok) break;
    } catch {}
    if (child.exitCode !== null) throw new Error(output);
    await new Promise((r) => setTimeout(r, 500));
  }
  for (const body of [
    {},
    { ticket: " " },
    { ticket: 9 },
    { ticket: "x", extra: true },
    { ticket: "x".repeat(20001) },
  ])
    await checkStatus(body, 400);
  assert.equal(calls, 0, "invalid requests must not call the provider");
  let r = await post("/api/triage", { ticket: "UI sort arrow missing" }),
    d = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(d.result, valid);
  assert.deepEqual(d.usage, { input: 11, output: 7, total: 18 });
  assert.equal(d.cost_usd, 0);
  await checkStatus({ ticket: "x", model: "unapproved" }, 400);
  mode = "retry";
  calls = 0;
  r = await post("/api/triage", { ticket: "x" });
  d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(calls, 2);
  assert.equal(d.usage.total, 36);
  mode = "invalid";
  await checkStatus({ ticket: "x" }, 502);
  mode = "length";
  await checkStatus({ ticket: "x" }, 502);
  mode = "wrong-model";
  r = await post("/api/triage", { ticket: "x" });
  assert.equal(r.status, 500);
  assert.ok(!(await r.text()).includes("private provider detail"));
  mode = "quota";
  await checkStatus({ ticket: "x" }, 429);
  mode = "ok";
  const runTest = async (dataset, count, replay, model = "test-model") => {
    const r = await post("/api/smoke", { dataset, count, replay, model });
    assert.equal(r.status, 200);
    const events = (await r.text()).trim().split("\n").map(JSON.parse),
      last = events.at(-1);
    assert.equal(last.type, "done");
    return last.run;
  };
  const run = await runTest("labelled100", 2);
  assert.equal(run.state, "complete");
  assert.equal(new Set(run.ticket_ids).size, 2);
  assert.equal(run.summary.processed, 2);
  assert.ok(run.rows.every((r) => r.expected));
  assert.equal(run.summary.cost_usd, 0);
  const again = await runTest("labelled100", 2, run.id, "test-model-2");
  assert.deepEqual(again.ticket_ids, run.ticket_ids);
  const clef = "@cf/cloudflare/clef-flash";
  r = await post("/api/triage", { ticket: "A display issue", model: clef });
  d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.result.category, "technical_bug");
  assert.equal(d.result.summary, null);
  assert.equal(d.result.suggested_action, null);
  assert.deepEqual(d.usage, { input: 100, output: 0, total: 100 });
  assert.ok(Math.abs(d.cost_usd - 0.0000038) < 1e-12);
  for (const bad of ["cf-invalid", "cf-inconsistent", "cf-invalid-json"]) {
    mode = bad;
    await checkStatus({ ticket: "x", model: clef }, 502);
  }
  mode = "cf-quota";
  await checkStatus({ ticket: "x", model: clef }, 429);
  mode = "cf-auth";
  r = await post("/api/triage", { ticket: "x", model: clef });
  assert.equal(r.status, 500);
  assert.ok(!(await r.text()).includes("provider-private"));
  mode = "ok";
  const cfRun = await runTest("labelled100", 2, run.id, clef);
  assert.deepEqual(cfRun.ticket_ids, run.ticket_ids);
  assert.equal(cfRun.prompt_version, "clef-v1");
  assert.equal(cfRun.summary.succeeded, 2);
  assert.equal(cfRun.summary.tokens.output, 0);
  const fullCf = await runTest("labelled100", 100, undefined, clef);
  assert.equal(fullCf.rows.length, 100);
  assert.equal(fullCf.summary.succeeded, 100);
  const unlabelled = await runTest("tickets500", 1);
  assert.equal(unlabelled.summary.category_accuracy, null);
  mode = "quota";
  const stopped = await runTest("labelled100", 3);
  assert.equal(stopped.state, "interrupted");
  assert.equal(stopped.rows.length, 1);
  assert.equal(stopped.summary.category_mismatches, 1);
  assert.equal(
    (await post("/api/smoke", { dataset: "labelled100", count: 101 })).status,
    400,
  );
  const history = await fetch(
    base + "/admin?left=" + run.id + "&right=" + again.id,
  );
  assert.equal(history.status, 200);
  assert.ok((await history.text()).includes("Same sample"));
  assert.equal((await fetch(base + "/api/runs/" + run.id)).status, 200);
  assert.equal((await fetch(base + "/api/runs/unknown")).status, 404);
  const schema = await (await fetch(base + "/api/triage")).json();
  assert.equal(schema.response.additionalProperties, false);
  const logs = await readFile(
    path.join(storage, "logs", "llm-calls.jsonl"),
    "utf8",
  );
  assert.ok(!logs.includes("test-key"));
  assert.ok(!logs.includes("test-cf-token"));
  assert.ok(!logs.includes("UI sort arrow"));
  assert.equal(
    (await readdir(path.join(storage, "runs"))).filter((n) =>
      n.endsWith(".json"),
    ).length,
    6,
  );
  console.log(
    "PASS: request validation, output validation/retry/truncation, usage, safe errors, sampling, both datasets, replay, quota-stop, persistence, admin comparison and privacy.",
  );
} catch (e) {
  console.error(e);
  console.error(output.slice(-4000));
  process.exitCode = 1;
} finally {
  child.kill();
  mock.close();
  for (const [name, content] of typeConfigBackups)
    await writeFile(name, content);
  setTimeout(() => process.exit(process.exitCode || 0), 1000).unref();
}
