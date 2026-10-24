# LLM–DM report

## Scope and assignment sources

This report addresses the Decision Model Integration Assignment on page 22 of the C5 "Decisions Decisions" presentation. That page requires hosted-model research and justification, a front-end strategy choice, smoke-test support, model tracking and this exact report filename. Page 23 restates the Teams F1–F5 requirements.

The companion C5 Part III presentation, page 2, specifies the complete triage submission: chat, Triage V2, the Teams assignment and the DM assignment. The extra deck also explicitly lists Triage V1. C3 Part II, pages 13–20 and 26, explains chat history, the plain-text V1 checkpoint, versioned prompts and the experiment journal. C4 continues the structured-output and evaluation work. C6's RAG specification describes a separate project.

## Hosted decision-model options researched

Research checked on 2026-10-24. Only Clef-Flash was actually called in this project; alternative entries below are documentation research, not comparative benchmark results.

| Option                                                  | Access and relevant properties                                                                                                                                                                                         | Decision                                                                                                                                                              |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Clef-Flash                                   | Hosted Workers AI REST model, 9B, typed choices, 24,576-token context, listed at $0.038/M input tokens; no output-token charge. [Model documentation](https://developers.cloudflare.com/workers-ai/models/clef-flash/) | Selected: the account/key was available, the live endpoint worked and the small closed label sets fit its API.                                                        |
| Cloudflare Clef                                         | Hosted decision model, 27B, 65,536-token context, listed at $0.24/M input tokens. [Model documentation](https://developers.cloudflare.com/workers-ai/models/clef/)                                                     | Considered for a future accuracy comparison. Its larger context was unnecessary for the present ticket bound; it was not tested, so no accuracy advantage is claimed. |
| vLLM Semantic Router Decision 3.0, for example d3-flash | The provider documents a free hosted System One endpoint, API keys and multiple models. [Official API documentation](https://decision.vllm-sr.ai/docs)                                                                 | A viable free alternative, but another credential/provider integration would add work without improving the evidence for the already-working integration. Not tested. |

Cloudflare's free allowance is 10,000 Neurons per day; additional usage requires a paid plan. A free allowance is limited access, not a permanently zero list price. [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/). This implementation never enrolls the user in paid billing.

**Why Clef-Flash:** it provides the two closed decisions needed here (four categories and three priorities), a hosted API with documented probabilities, no local GPU requirement, and access already verified using our configured account. We selected it for integration practicality, not because we established it as the best available decision model.

## Integration strategy

The front-end **Strategy and model** selector supports two explicit strategies:

- **LLM · generate:** Gemini produces category, priority, summary and suggested action. The model's JSON is parsed and checked with the original strict Zod schema.
- **DM · classify:** Clef-Flash returns category and priority plus their probability distributions. Summary and suggested_action are explicitly null; the UI explains that these fields require a generative model.

We considered **DM + LLM**, where Clef classifies and Gemini writes the summary/action. We did not implement that optional combination. It would require two provider calls, accumulate their cost/latency, and complicate attribution. Separate selectable strategies make the experiment inspectable: a Clef result never includes a hidden Gemini call.

This choice follows the assignment's instruction to choose how to use the DM and expose the chosen strategy in the UI. The prompt asks about possible strategies; it does not explicitly require every combination.

### Request-to-result trace

1. app/model-picker.tsx loads model IDs from /api/config; credentials are never returned.
2. /api/triage validates the request with TicketSchema and verifies the server allowlist.
3. lib/triage.ts dispatches the Clef model ID to lib/decision.ts; other configured IDs use the LLM SDK.
4. Clef receives only the ticket's subject/body as state and the two versioned choice questions from DECISION_QUESTIONS. Expected labels and label notes never enter the prompt.
5. The server validates the provider envelope, allowed choices, probability bounds, approximately normalized distributions and consistency of the selected option with its distribution.
6. The browser validates the returned result using the appropriate Zod variant and renders it safely as text.
7. Metadata logs record model/API/prompt version, status, usage, cost estimate and latency. The smoke runner stores selected IDs, predictions, expected labels, outcomes and run metrics.

The DM questions use version clef-v1; the generative prompt uses triage-v2. Request timeout is 30 seconds. The DM path has no automatic retries; the generative SDK and invalid-output retry policy are described in README.md. Configuration/authentication errors, quota, invalid responses, transport failures and timeouts receive controlled errors.

## Evaluation method

The labelled development set contains 100 supplied tickets. The 500-ticket set has no ground truth. Server-side sampling uses Fisher–Yates without replacement. Exact replay reuses the recorded ticket IDs for another model.

Accuracy includes all processed labelled rows; a failed prediction counts as incorrect for both fields. Unprocessed tickets are not silently counted as successes. Failed outputs also appear in the confusion matrix. The admin page and downloaded JSON distinguish complete and interrupted runs.

We measured category and priority agreement separately, outcome counts, wall-clock ticket latency, token usage and estimated USD cost. We checked one injection ticket (TCK-10087) and the browser result/usage display. This does not establish general injection resistance or confidence calibration.

## Measured results

All results below are from actual provider calls. Mock-provider tests check implementation behaviour and are not included as model-quality evidence.

| Model / experiment                                 | Processed / successful | Category | Priority | Mean latency | Tokens                 | Estimated USD                    |
| -------------------------------------------------- | ---------------------- | -------- | -------- | ------------ | ---------------------- | -------------------------------- |
| Gemini 3.5 Flash-Lite, original five-ticket sample | 5 / 5                  | 80%      | 100%     | 7.35 s       | 1,827                  | 0, configured free tier          |
| Gemini 3.1 Flash-Lite, identical sample            | 5 / 4                  | 60%      | 60%      | 15.12 s      | unavailable overall    | unavailable: one timeout         |
| Clef-Flash, identical five-ticket replay           | 5 / 5                  | 80%      | 100%     | 0.52 s       | 2,074 input; 0 output  | 0.000078812, list-price estimate |
| Clef-Flash, complete labelled development set      | 100 / 100              | 91%      | 67%      | 0.51 s       | 48,454 input; 0 output | 0.001841252, list-price estimate |

The five-ticket replay IDs match the Gemini baseline exactly. Both models made the same account-versus-bug disagreement. Clef matched category/priority quality on that sample and returned sooner. However, Gemini also wrote the summary/action, so the latency comparison includes different workloads. Five cases do not support a general model ranking.

The complete Clef run shows the limits hidden by the five-ticket result:

- Category: seven account tickets became technical_bug; two feature requests became technical_bug.
- Priority: seven high tickets became medium, giving high-priority recall of 14/21, approximately 66.7%.
- Seventeen medium tickets became low; four medium became high.
- Five low tickets became medium.

The larger result supports investigating Clef for category routing. It does not support unattended priority assignment. Next experiments should revise the business-impact rubric using observed failures, keep a separate evaluation subset, and measure whether changes improve results without increasing dangerous downgrades.

### Cost interpretation

Cloudflare costs use the configured published input rate of $0.038/M; the free allocation is not deducted. Gemini's earlier runs use a configured free-tier rate of zero. These are different pricing bases, so the table cannot establish billed savings between providers. No invoice or remaining Cloudflare allowance was measured. New runs preserve their configured price basis in their metadata.

### Evidence files

- runs/19f9373c-caa3-4a60-af38-20038dceafee.json — Gemini 3.5 baseline.
- runs/db02720d-f91f-4acc-85f6-eaa0494df66c.json — Gemini 3.1 comparison.
- runs/2853ecc4-ada9-4943-8683-a0ffd8968d38.json — Clef identical-sample replay.
- runs/758c7342-5b1b-42aa-97b4-b90159cb2df0.json — all 100 labelled tickets.
- output/decision-verification.json — injection result, run references and pricing basis.
- output/clef-result.png — actual browser result.
- EXPERIMENTS.md — observations and changes.

One initial larger run stopped at 98 successful processed tickets and is retained as interrupted. The original exception was not preserved, so its root cause remains unconfirmed. Added safe diagnostics and bounded Windows file-replacement retries; repeated 100-ticket mock and live runs completed. The interrupted run is excluded from the full-100 result above.

## Capability limits and verification

Clef cannot write summaries, actions or explanations. A typed output guarantees neither semantic correctness nor trustworthy confidence. We validate shape and distribution consistency, but have not measured calibration or chosen an empirically justified review threshold. No automatic action or customer response is sent.

The integration suite checks request rejection before provider calls, allowlisting, malformed labels/JSON/distributions, safe auth/quota errors, null generative fields, usage/cost mapping, replay, persistence and a 100-ticket mock run. TypeScript, production build and browser checks supplement it. A separate plain-text V1 page preserves the earlier teaching checkpoint while the default V2 flow validates structured output.

**Task choice:** Clef-Flash is a fast category-routing candidate with reviewed urgency; Gemini is needed when the workflow must produce readable summaries and next actions.

AI assistance was used for implementation and this report. Measured results are backed by the saved artifacts. The student should be able to trace a request, explain the strategy trade-offs and modify the decision rubric without regenerating the project.

## V1 checkpoint verification

The restored /triage-v1 page preserves the plain-text checkpoint from C3 Activity 3. Its output intentionally has no classification schema, while input guards remain enabled. The versioned V1 prompt lives beside the V2 prompt in lib/prompt.ts.

Five live Gemini calls were saved in output/v1-verification.json: TCK-10001 (obvious cosmetic bug), TCK-10017 (ambiguous wording), TCK-10019 (long ticket), TCK-10087 (injected instruction), and TCK-10005 (invoice request). All returned readable text. Against the available labelled cases, V1 correctly gave TCK-10001 low priority, but over-escalated TCK-10017 and TCK-10019 to high where both labels are medium. The injection example did not produce pirate instructions, but was treated as technical_bug rather than the billing category used by the course example. The PO-number request became feature_request rather than the course example's billing-related interpretation.

This is a useful contrast with the more explicit V2 rubric, not proof that format validation fixes judgment. V1 is retained as an observable baseline; its prompt was not silently tuned after seeing these failures. To repeat these real calls: node --env-file=.env.local scripts/verify-v1.mjs (requires a built app and configured Gemini access).
