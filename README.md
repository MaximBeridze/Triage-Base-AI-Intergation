# Kestrel support ticket triage

A Next.js application that classifies support requests using Gemini through the OpenAI-compatible Chat Completions API. The implementation follows the instructor's Teams F1–F5 feature checklist; the course PDF supplies the API and validation workflow.

## Run locally

Requires Node.js 20.9+ and a Gemini API key with access to the configured models.

```powershell
npm ci
Copy-Item .env.example .env.local
# Edit .env.local and insert your private key.
npm run dev
```

Do not overwrite an existing .env.local containing your key. Open http://localhost:3033.

- **/**: submit a ticket, select a model, see classification and token usage.
- **/smoke**: choose either dataset, select a random sample size, and run the evaluation.
- **/admin**: inspect every saved run, download JSON, and compare two runs side by side.
- **/chat**: original chat exercise with conversation history stored in page memory.

Start with a sample of 5. Calls are sequential, with a configurable delay. Larger samples may take many minutes and encounter free-tier quotas. Keep the smoke-test tab open.

## Feature checklist

- [x] **F1:** request and response contracts defined with Zod, JSON Schema generated from those contracts, server input checks before provider calls, response checks before returning results, visible front-end errors.
- [x] **F2:** input, output and total token usage displayed with each result. Missing usage is explicitly unavailable.
- [x] **F3:** front-end smoke runner, dataset choice (100 labelled or 500 unlabelled), random sampling without replacement, live rows, predicted/expected category and priority, mismatch counts.
- [x] **F4:** saved run accuracy, outcome counts, mean latency, estimated USD cost and model name; /admin lists runs.
- [x] **F5 optional:** server-allowlisted model selector, exact-sample replay with another model, and side-by-side /admin comparison.

## Demonstration

1. Submit an empty ticket: the page displays a clear validation error.
2. Submit a production outage: inspect category, priority, summary, suggested action and token counts.
3. Open /smoke. Choose 100 labelled tickets and sample 5.
4. Watch each result arrive; inspect predicted/expected labels and mismatch totals.
5. Select another model, check **Reuse this exact sample**, and run again without changing dataset/count.
6. Open /admin, select both runs and compare quality, latency, outcome counts and cost.
7. Run one ticket from the 500 set: predictions are shown but accuracy is N/A because labels are absent.

## Configuration

All secrets remain on the server. /api/config returns model IDs only.

| Setting                      | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| LLM_BASE_URL                 | Provider's OpenAI-compatible API base URL              |
| LLM_API_KEY                  | Private provider key                                   |
| LLM_MODEL                    | Default model                                          |
| LLM_MODELS                   | Comma-separated allowlist of selectable model IDs      |
| LLM_STRUCTURED_OUTPUT        | json_schema (default) or prompt                        |
| LLM_INPUT_PRICE_PER_MILLION  | Configured input price in USD                          |
| LLM_OUTPUT_PRICE_PER_MILLION | Configured output price in USD                         |
| SMOKE_DELAY_MS               | Delay between tickets; default 4500 ms                 |
| TRIAGE_STORAGE_DIR           | Optional writable storage root; default project folder |

Prices apply to all configured models: use models with the same configured rates, or update prices before a new run. Set rates to zero only when the API project is confirmed to use free-tier billing. Unknown prices or token usage produce **unavailable**, never an invented zero. A failed request can incur unreported usage; run cost is unavailable if any row has unknown cost.

Gemini access changes over time. A listed model can still be unavailable to your project or quota. Change the allowlist and default using your own accessible model IDs. Restart after environment changes. No automatic paid-tier upgrade is performed.

## Architecture and API

Browser → route validation → lib/triage.ts → lib/llm.ts → provider → JSON parse + Zod → browser.

- lib/schema.ts is the source of truth for input and triage output.
- lib/prompt.ts contains the business rules and PROMPT_VERSION (triage-v2).
- lib/triage.ts requests strict JSON Schema, rejects truncation, parses JSON and validates with Zod. Prompt mode strips an optional code fence but still validates.
- lib/runs.ts samples server-side using Fisher–Yates and evaluates **subject + body only**. Labels, tags and notes never enter the prompt.
- lib/storage.ts saves atomic per-run JSON checkpoints to runs/ and appends metadata to logs/llm-calls.jsonl.
- /api/triage GET publishes both JSON schemas; POST accepts { ticket, model? } and returns { result, model, usage, latency_ms, cost_usd }.
- /api/smoke POST accepts { dataset: "labelled100" | "tickets500", count, model?, replay? } and streams newline-delimited JSON progress events.
- /api/runs/:id downloads a run.

Input tickets must contain 1–20,000 trimmed characters. Response fields: category (billing/technical_bug/account/feature_request), priority (low/medium/high), summary (1–300 characters), suggested_action (1–500). Extra keys are rejected.

A larger bound than 5,000 allows the supplied long tickets while rejecting oversized input before a provider call. Invalid JSON/input returns 400, quota 429, invalid model output/network/provider failures 502, timeout 504, and bad provider configuration 500. No raw provider error reaches the browser.

Timeout: 30 seconds per SDK attempt; one SDK retry for transient errors. Malformed model output has one additional bounded retry. Usage totals on a successful ticket include both malformed and valid attempts. The runner stops early on 429 or configuration 500 and records an interrupted run with the actual processed count.

## Evaluation

Accuracy denominator = all **processed labelled tickets**, including failures. A failed call counts as both a category and priority mismatch. Unprocessed tickets are excluded and the processed/requested counts remain visible. The 500 set has no accuracy labels. Confusion matrices include a "(failed)" prediction column.

Real verification on 2026-10-24, identical random sample of 5 labelled tickets:

| Model                 | Successful | Category accuracy | Priority accuracy | Mean latency | Estimated USD             |
| --------------------- | ---------- | ----------------- | ----------------- | ------------ | ------------------------- |
| gemini-3.5-flash-lite | 5/5        | 80%               | 100%              | 7.35 s       | 0 (configured free tier)  |
| gemini-3.1-flash-lite | 4/5        | 60%               | 60%               | 15.12 s      | unavailable (one timeout) |

Three observations: 3.5 completed all calls while 3.1 timed out once; 3.5 was faster in this run; 3.5 agreed more often with labels on this small sample. This is a smoke test, not an unbiased model benchmark. One account-vs-bug disagreement occurred on both models and should be investigated before changing the prompt. The one-ticket 500-set run also succeeded. Full evidence is in runs/ and output/live-verification.json.

## Verification

```powershell
npm run typecheck
npm run build
npm test
# Optional: sends real calls using .env.local (12 calls before retries).
npm run test:live
```

npm test starts an isolated local mock provider and Next server. It tests invalid requests, Zod output rejection, invalid-output retry and token accumulation, truncation, safe 404/429 handling, both datasets, sample uniqueness, exact replay, quota interruption, saved runs, downloads, admin comparison and log privacy. It requires permission to bind/connect to localhost. Mock results are kept in ignored tmp-tests-* folders and never presented as real model quality results.

npm run build and the integration suite passed. The browser was also checked for the empty-ticket error, a production-outage classification and visible token counts. Next.js was updated to 16.4.3 to resolve the reported dependency advisories; npm audit then reported zero vulnerabilities.

## Quality checklist and limitations

- [x] SDK access and credentials are server-side.
- [x] .env.local is Git-ignored; browser configuration exposes no key.
- [x] Input/output contracts use real runtime validation.
- [x] Prompts are versioned and ticket instructions are treated as untrusted data.
- [x] The TCK-10087 injected instruction returned a normal billing/low result in the live check.
- [x] Metadata logs exclude the key and full ticket text.
- [x] Controlled errors and explicit bounded retries/timeouts.
- [x] Fixed a real validation gap: empty conversations and client-supplied system roles are rejected in the chat exercise.
- [x] Saved evidence distinguishes actual calls from mocked tests.

This is a **local classroom app** with filesystem storage. It has no authentication; do not expose its admin and model-calling endpoints publicly without adding access controls and rate limits. A writable persistent disk is required; ephemeral serverless storage is unsuitable. A killed server may leave the last checkpoint marked running; rows already saved remain available. Large samples can exceed hosting time limits. Prompt-injection resistance is not guaranteed by schema validation: schemas enforce shape, not semantic correctness. Human review remains necessary.

## Git delivery

Features were developed as stacked branches so every later branch includes the preceding features:

1. F1/Structured-Triage-Flow
2. codex/f2-token-usage
3. codex/f3-smoke-runner
4. codex/f4-run-history
5. codex/f5-model-comparison
6. codex/submission-verification (integrated submission)

Each feature has a dedicated commit. The verification branch includes final tests, documentation and real run evidence. The unrelated existing test.py is not part of the submission changes.

## References

- [Zod JSON Schema conversion](https://zod.dev/json-schema)
- [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)
- [Gemini API pricing and free-tier conditions](https://ai.google.dev/gemini-api/docs/pricing)
- Instructor's Teams F1–F5 checklist and provided Session 2 course PDF.

AI assistance was used for implementation, verification and documentation. Experiments and measured failures are recorded in EXPERIMENTS.md.

## Decision-model experiment (Activity 10)

Clef-Flash is integrated as **@cf/cloudflare/clef-flash** through Cloudflare Workers AI REST. It appears in both model selectors when CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are configured in .env.local. These credentials are never returned by /api/config. No Cloudflare Worker deployment is needed.

Clef receives the ticket as state and two typed choice questions. It returns category/priority distributions; it does not generate summaries or actions. The decision result has explicit null summary/action fields and a separate Zod schema. The browser explains this limitation rather than fabricating prose or making a hidden Gemini call. The original Gemini response schema remains unchanged. GET /api/triage also exposes decision_response.

- lib/decision.ts: typed questions (clef-v1), fixed REST model, 30-second timeout, no automatic retries, response/probability validation, safe errors and metadata logging.
- Distribution values must be between 0 and 1, sum to approximately 1, and the selected label must have the highest probability. These checks establish consistency, not calibrated certainty.
- Usage is mapped to input/output/total; output tokens are zero for this decision model. Missing provider usage remains unavailable.
- CLOUDFLARE_INPUT_PRICE_PER_MILLION is independent of Gemini pricing. The saved runs use **0.038 USD per million input tokens**, the published list-price estimate, with no free-allocation deduction. These estimates are not invoices or evidence of charges.
- New runs preserve their configured pricing basis. Historical runs retain the pricing explanation in this README.
- Existing smoke sampling, exact replay, confusion matrices, logging and admin comparison work for Clef.

### Actual results — 2026-10-24

| Run                            | Tickets                  | Category accuracy | Priority accuracy | Mean latency | Estimated USD            |
| ------------------------------ | ------------------------ | ----------------- | ----------------- | ------------ | ------------------------ |
| Gemini 3.5 Flash-Lite baseline | Same 5 labelled IDs      | 80%               | 100%              | 7.35 s       | 0 (configured free tier) |
| Clef-Flash replay              | Same 5 labelled IDs      | 80%               | 100%              | 0.52 s       | 0.000078812 (list price) |
| Clef-Flash full dev set        | All 100 labelled tickets | 91%               | 67%               | 0.51 s       | 0.001841252 (list price) |

The full run completed 100/100 calls with 48,454 input tokens and no generated tokens. Seven high-priority tickets were downgraded to medium; 17 medium-priority tickets became low. Seven account tickets were labelled technical_bug. This identifies priority decisions and the account/bug boundary as concrete weaknesses to investigate.

The five-ticket replay is a small direct classification comparison. Latency also reflects that Gemini generates summaries/actions while Clef does not; it is not an equivalent full-output speed benchmark. The full 100-ticket result is a development-set measurement, not an unseen hold-out score.

**Which model for which task:** use Clef as a fast category-routing candidate, with reviewed priority decisions; use Gemini when written summaries and next actions are required. No automatic routing threshold is claimed to be calibrated by this experiment.

Evidence:

- Replay: runs/2853ecc4-ada9-4943-8683-a0ffd8968d38.json
- Full dev set: runs/758c7342-5b1b-42aa-97b4-b90159cb2df0.json
- Original Gemini baseline: runs/19f9373c-caa3-4a60-af38-20038dceafee.json
- output/decision-verification.json and output/clef-result.png
- [Open the saved comparison](http://localhost:3033/admin?left=19f9373c-caa3-4a60-af38-20038dceafee&right=2853ecc4-ada9-4943-8683-a0ffd8968d38)

An initial full-set attempt stopped at 98 processed tickets with no provider-failure rows. Its interrupted checkpoint is retained (ee61c595-8a72-4351-aa1e-2d7a15ff6d92). The original exception was not captured, so its root cause is unconfirmed. Added safe server diagnostics and bounded retries for transient Windows file-replacement locks; the regression suite's 100-ticket mock run and the repeated live 100-ticket run both completed. The earlier five-ticket Clef run is retained too.

To repeat the decision experiment (106 real calls before any manual retry):

```powershell
npm run test:clef
```

This starts a production server on port 3042, uses the existing five-ticket baseline for replay, then runs the full labelled set. Run npm run build first. Your Cloudflare free allowance and rate limits still apply. The runner stops on quota/configuration failure, without enabling paid billing.

The integration suite now also covers Cloudflare routing, invalid labels/JSON/probabilities, safe authorization/quota errors, null generation fields, usage/cost conversion, exact replay and a complete 100-ticket decision-model run.

References: [Clef-Flash model and API](https://developers.cloudflare.com/workers-ai/models/clef-flash/), [Workers AI free allocation and pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

## Final assignment alignment

The C5 Decisions Decisions deck (page 22) requires **LLM-DM-report.md**. That report now contains hosted-model alternatives, selection justification, strategy choices, results, analysis and limitations. The strategy/model menus explicitly label **LLM · generate** and **DM · classify**; a combined DM+LLM flow was considered but is not implemented.

Plain-text **Triage V1** is available at /triage-v1 using POST /api/triage/v1. Its prompt and version are in lib/prompt.ts. It shares request guards and safe errors, but deliberately does not validate classification fields in the model's prose. The default / page remains structured **V2**. This preserves both teaching checkpoints in the final app.

Course-document cross-check: C3 defines chat history and V1; C4 continues V2 and evaluation; the Teams checklist defines F1–F5; C5 Part III and its extra deck define the complete submission and mandatory DM report. The C6 RAG specification belongs to a separate project.

**Submission:** C5 states Saturday 24 October 2026 at 13:00, by email to denis.amselem@epita.fr. The repository has been pushed; no email has been sent by this agent. Sending the repository link by the required channel remains the student's action.
