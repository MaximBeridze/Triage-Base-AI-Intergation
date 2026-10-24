# Experiments

Only actual model calls are listed below. Mock-provider checks are documented separately in README.md.

| Date       | Prompt version | Provider / model               | Ticket / run                         | Observed output                                       | Problem noticed                                                         | Change made                                                               |
| ---------- | -------------- | ------------------------------ | ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 2026-10-24 | triage-v2      | Google / gemini-3.5-flash-lite | TCK-10087                            | Valid billing / low; summary concerned past invoices  | No injected instruction followed in this sample                         | Kept prompt; schema checked                                               |
| 2026-10-24 | triage-v2      | Google / gemini-3.5-flash-lite | 19f9373c-caa3-4a60-af38-20038dceafee | 5/5 successful; category 80%, priority 100%           | One account ticket classified technical_bug                             | Recorded disagreement; no unmeasured prompt change                        |
| 2026-10-24 | triage-v2      | Google / gemini-3.1-flash-lite | db02720d-f91f-4acc-85f6-eaa0494df66c | Same 5 IDs; 4/5 successful; category/priority 60%     | One timeout; high-priority case predicted medium; same account mismatch | Kept explicit failure outcome and unknown total cost; prefer 3.5 for demo |
| 2026-10-24 | triage-v2      | Google / gemini-3.5-flash-lite | 47ef0cc7-581f-4c32-879a-7a61d67919b1 | 1/1 successful from unlabelled 500 set                | No labels available                                                     | Accuracy shown as N/A                                                     |
| 2026-10-24 | triage-v2      | Google / gemini-3.5-flash-lite | Browser outage example               | technical_bug / high; input 260, output 80, total 340 | None observed                                                           | Confirmed UI token display                                                |

Five tickets are insufficient to establish general accuracy. The labelled subset is a development set; these results do not substitute for a separate hold-out evaluation.

## Decision-model experiments

| Date       | Prompt version | Provider / model        | Ticket / run                         | Observed output                                                       | Problem noticed                                                            | Change made                                                                             |
| ---------- | -------------- | ----------------------- | ------------------------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 2026-10-24 | clef-v1        | Cloudflare / clef-flash | TCK-10087                            | billing / low with valid distributions; no generated text             | No injection compliance observed in this case                              | Kept typed questions                                                                    |
| 2026-10-24 | clef-v1        | Cloudflare / clef-flash | 873bf026-abb8-407a-a269-c21794a8d6e6 | Original five-ticket replay: 80% category, 100% priority, 1.01 s mean | Account/bug disagreement persisted                                         | Recorded rather than tuning to these five labels                                        |
| 2026-10-24 | clef-v1        | Cloudflare / clef-flash | ee61c595-8a72-4351-aa1e-2d7a15ff6d92 | Interrupted after 98 processed tickets, all provider calls successful | Outer run failure; original exception unavailable                          | Added safe diagnostics and bounded Windows rename retries; root cause unconfirmed       |
| 2026-10-24 | clef-v1        | Cloudflare / clef-flash | 2853ecc4-ada9-4943-8683-a0ffd8968d38 | Repeated five-ticket replay: 80% category, 100% priority, 0.52 s mean | Same category disagreement                                                 | Kept version for larger evaluation                                                      |
| 2026-10-24 | clef-v1        | Cloudflare / clef-flash | 758c7342-5b1b-42aa-97b4-b90159cb2df0 | All 100: category 91%, priority 67%, mean 0.51 s                      | Seven high-to-medium priority errors; seven account-to-bug category errors | Recommend reviewed priority decisions; future rubric tuning needs a separate evaluation |

## Plain-text V1 baseline

| Date       | Prompt version | Provider / model      | Ticket    | Observation           | Failure / next action                                                                        |
| ---------- | -------------- | --------------------- | --------- | --------------------- | -------------------------------------------------------------------------------------------- |
| 2026-10-24 | triage-v1      | Gemini 3.5 Flash-Lite | TCK-10001 | technical_bug / low   | Matches provided label                                                                       |
| 2026-10-24 | triage-v1      | Gemini 3.5 Flash-Lite | TCK-10017 | technical_bug / high  | Expected medium; baseline prompt over-escalates lost work                                    |
| 2026-10-24 | triage-v1      | Gemini 3.5 Flash-Lite | TCK-10019 | technical_bug / high  | Expected medium; slowdown despite continued work over-escalated                              |
| 2026-10-24 | triage-v1      | Gemini 3.5 Flash-Lite | TCK-10087 | technical_bug / low   | Injection not obeyed, but billing/how-to category interpretation differs from course example |
| 2026-10-24 | triage-v1      | Gemini 3.5 Flash-Lite | TCK-10005 | feature_request / low | Differs from the course's billing-related interpretation; not in labelled 100 subset         |

Full plain-text outputs and token counts are preserved in output/v1-verification.json. Keep V1 unchanged as a baseline; test rubric changes under a new version rather than modifying recorded results.
