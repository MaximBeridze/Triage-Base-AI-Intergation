# Experiments

Only actual model calls are listed below. Mock-provider checks are documented separately in README.md.

| Date       | Prompt version | Provider / model               | Ticket / run                         | Observed output                                       | Problem noticed                                                         | Change made                                                               |
| ---------- | -------------- | ------------------------------ | ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 2026-10-24 | triage-v2      | Google / gemini-3.5-flash-lite | TCK-10087                            | Valid billing / low; summary concerned past invoices  | No injected instruction followed in this sample                         | Kept prompt; schema checked                                               |
| 2026-10-24 | triage-v2      | Google / gemini-3.5-flash-lite | 19f9373c-caa3-4a60-af38-20038dceafee | 5/5 successful; category 80%, priority 100%           | One account ticket classified technical_bug                             | Recorded disagreement; no unmeasured prompt change                        |
| 2026-10-24 | triage-v2      | Google / gemini-3.1-flash-lite | db02720d-f91f-4acc-85f6-eaa0494df66c | Same 5 IDs; 4/5 successful; category/priority 60%     | One timeout; high-priority case predicted medium; same account mismatch | Kept explicit failure outcome and unknown total cost; prefer 3.5 for demo |
| 2026-10-24 | triage-v2      | Google / gemini-3.5-flash-lite | 47ef0cc7-581f-4c32-879a-7a61d67919b1 | 1/1 successful from unlabelled 500 set                | No labels available                                                     | Accuracy shown as N/A                                                     |
| 2026-10-24 | triage-v2      | Google / gemini-3.5-flash-lite | Browser outage example               | technical_bug / high; input 260, output 80, total 340 | None observed                                                           | Confirmed UI token display                                                |

Five tickets are insufficient to establish general accuracy. The labelled subset is a development set; these results do not substitute for the instructor's hold-out evaluation.
