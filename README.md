# Support ticket triage

A support-ticket triage app built with Next.js, TypeScript and Zod. It supports Gemini for text generation and Cloudflare Clef-Flash for classification.

## Setup

Requires Node.js 20.9 or newer.

```powershell
npm ci
Copy-Item .env.example .env.local
```

Fill in the Gemini settings in .env.local:

```dotenv
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
LLM_API_KEY=your_api_key
LLM_MODEL=gemini-3.5-flash-lite
LLM_MODELS=gemini-3.5-flash-lite,gemini-3.1-flash-lite
LLM_STRUCTURED_OUTPUT=json_schema
```

To enable Clef-Flash, also set:

```dotenv
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
```

Keep credentials in .env.local, which is ignored by Git. If that file already exists, edit it instead of copying over it.

```powershell
npm run dev
```

Open [localhost:3033](http://localhost:3033).

## Features

| Page       | Purpose                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| /          | Structured triage: category, priority, summary, suggested action and token usage |
| /triage-v1 | Plain-text triage                                                                |
| /chat      | Chat with conversation history                                                   |
| /smoke     | Random-sample evaluation on either ticket dataset                                |
| /admin     | Saved runs, downloads and model comparisons                                      |

The strategy selector offers:

- **LLM:** Gemini generates all four triage fields.
- **DM:** Clef-Flash predicts category and priority with probabilities. It does not generate summaries or actions.

Requests and structured responses are validated with Zod. Invalid input, provider errors and quota failures are displayed on the page.

## Smoke tests

Choose the labelled 100-ticket dataset or the unlabelled 500-ticket dataset, select a sample size, then start the run. Tickets are sampled without replacement and results appear as they finish. Keep the page open while the test runs.

For labelled tickets, predictions are displayed beside the expected category and priority. The summary includes mismatch counts and confusion matrices. Failed predictions count as mismatches; accuracy is unavailable for the unlabelled dataset.

To compare models, finish a run, choose another model and select **Reuse this exact sample**. Keep the dataset and sample size unchanged. Open /admin and select the two runs.

Run results are saved in runs/. Call metadata is stored in logs/llm-calls.jsonl. Logs exclude API keys and full ticket text.

## Configuration

See .env.example for all settings.

| Variable                           | Purpose                                                        |
| ---------------------------------- | -------------------------------------------------------------- |
| LLM_STRUCTURED_OUTPUT              | json_schema or prompt; both validate the final result with Zod |
| LLM_INPUT_PRICE_PER_MILLION        | Gemini input price in USD per million tokens                   |
| LLM_OUTPUT_PRICE_PER_MILLION       | Gemini output price in USD per million tokens                  |
| CLOUDFLARE_INPUT_PRICE_PER_MILLION | Separate input price for Clef                                  |
| SMOKE_DELAY_MS                     | Delay between tickets; defaults to 4500 ms                     |
| TRIAGE_STORAGE_DIR                 | Storage directory; defaults to the project folder              |

Leave prices blank when unknown. Set zero only for confirmed free-tier usage. Cost estimates use the configured rates; they do not track provider allowances or invoices. Missing token usage is shown as unavailable.

Restart the server after changing environment settings.

## Project structure

- app/: pages and API routes.
- lib/schema.ts: request and response contracts.
- lib/prompt.ts: versioned V1 and V2 prompts.
- lib/triage.ts: structured LLM triage.
- lib/decision.ts: Clef questions, API call and probability validation.
- lib/runs.ts: sampling and evaluation metrics.
- lib/storage.ts: saved runs and call logs.
- data/: supplied ticket datasets.
- scripts/: automated and live verification.

## Checks

```powershell
npm run typecheck
npm test
npm run build
npm run start
```

npm test uses a local mock provider. The following commands make real provider calls and require configured credentials and a production build:

```powershell
npm run test:live
npm run test:clef
node --env-file=.env.local scripts/verify-v1.mjs
```

## Results and limitations

Clef-Flash achieved **91% category accuracy** and **67% priority accuracy** on the 100 labelled development tickets, with a mean latency of **0.51 seconds**. Seven high-priority tickets were classified as medium, so priority decisions need review.

The five-ticket Gemini/Clef comparison uses identical ticket IDs. Gemini also generates prose, so its latency includes more work. Development-set results are not hold-out scores, and probabilities have not been calibrated.

The app uses local filesystem storage and has no authentication. Public deployment would require access controls, rate limiting and persistent storage.

See [LLM-DM-report.md](LLM-DM-report.md) for model research, strategy choices and analysis, and [EXPERIMENTS.md](EXPERIMENTS.md) for recorded observations.
