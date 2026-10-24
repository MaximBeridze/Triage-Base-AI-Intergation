import { z } from "zod";
import { randomInt, randomUUID } from "node:crypto";
import labelled from "../data/support_tickets_100_labelled.json";
import unlabelled from "../data/support_tickets_500.json";
import { triage } from "./triage";
import { TicketSchema } from "./schema";
import { safeError } from "./errors";
import { PROMPT_VERSION } from "./prompt";
import { DECISION_MODEL, DECISION_VERSION } from "./decision";
import type { DisplayResult } from "./schema";
export const RunRequestSchema = z.strictObject({
  dataset: z.enum(["labelled100", "tickets500"]),
  count: z.number().int().min(1).max(500),
  model: z.string().max(100).optional(),
  replay: z.string().uuid().optional(),
});
export type RunRow = {
  ticket_id: string;
  expected: { category: string; priority: string } | null;
  predicted: DisplayResult | null;
  status: number;
  error?: string;
  latency_ms: number;
  usage: { input: number; output: number; total: number } | null;
  cost_usd: number | null;
  tags: string;
};
export type Run = {
  id: string;
  created_at: string;
  prompt_version: string;
  model: string;
  cost_basis?: string;
  dataset: string;
  requested: number;
  ticket_ids: string[];
  state: "running" | "complete" | "interrupted";
  rows: RunRow[];
  summary: ReturnType<typeof summarize>;
};
export function summarize(rows: RunRow[]) {
  const labelled = rows.filter((r) => r.expected);
  const success = rows.filter((r) => r.status === 200);
  const category_mismatches = labelled.filter(
    (r) => r.predicted?.category !== r.expected?.category,
  ).length;
  const priority_mismatches = labelled.filter(
    (r) => r.predicted?.priority !== r.expected?.priority,
  ).length;
  const matrix = (key: "category" | "priority") => {
    const result: Record<string, Record<string, number>> = {};
    for (const row of labelled) {
      const actual = row.expected![key],
        predicted = row.predicted?.[key] || "(failed)";
      result[actual] ??= {};
      result[actual][predicted] = (result[actual][predicted] || 0) + 1;
    }
    return result;
  };
  return {
    processed: rows.length,
    succeeded: success.length,
    outcomes: rows.reduce<Record<string, number>>((a, r) => {
      a[r.status] = (a[r.status] || 0) + 1;
      return a;
    }, {}),
    category_mismatches,
    priority_mismatches,
    category_accuracy: labelled.length
      ? (labelled.length - category_mismatches) / labelled.length
      : null,
    priority_accuracy: labelled.length
      ? (labelled.length - priority_mismatches) / labelled.length
      : null,
    mean_latency_ms: rows.length
      ? rows.reduce((a, r) => a + r.latency_ms, 0) / rows.length
      : 0,
    cost_usd:
      rows.length && rows.every((r) => r.cost_usd !== null)
        ? rows.reduce((a, r) => a + r.cost_usd!, 0)
        : null,
    tokens:
      rows.length && rows.every((r) => r.usage)
        ? rows.reduce(
            (a, r) => ({
              input: a.input + r.usage!.input,
              output: a.output + r.usage!.output,
              total: a.total + r.usage!.total,
            }),
            { input: 0, output: 0, total: 0 },
          )
        : null,
    category_matrix: matrix("category"),
    priority_matrix: matrix("priority"),
  };
}
export function createRun(
  dataset: "labelled100" | "tickets500",
  count: number,
  model: string,
  ids?: string[],
): Run {
  const source = dataset === "labelled100" ? labelled : unlabelled;
  if (count > source.length) throw new Error("Sample exceeds dataset size.");
  const pool = source.map((t) => t.ticket_id);
  // Fisher-Yates: random sample without replacement.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (
    ids &&
    (ids.length !== count ||
      new Set(ids).size !== count ||
      ids.some((id) => !source.some((t) => t.ticket_id === id)))
  )
    throw new Error("Invalid replay sample.");
  return {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    prompt_version:
      model === DECISION_MODEL ? DECISION_VERSION : PROMPT_VERSION,
    model,
    cost_basis:
      model === DECISION_MODEL
        ? `Configured USD per million tokens: input ${process.env.CLOUDFLARE_INPUT_PRICE_PER_MILLION || "unknown"}; output 0. Free allocation is not automatically deducted.`
        : `Configured USD per million tokens: input ${process.env.LLM_INPUT_PRICE_PER_MILLION || "unknown"}; output ${process.env.LLM_OUTPUT_PRICE_PER_MILLION || "unknown"}.`,
    dataset,
    requested: count,
    ticket_ids: ids || pool.slice(0, count),
    state: "running",
    rows: [],
    summary: summarize([]),
  };
}
export async function evaluateTicket(run: Run, id: string): Promise<RunRow> {
  const source = run.dataset === "labelled100" ? labelled : unlabelled;
  const ticket = source.find((t) => t.ticket_id === id)!;
  const truth =
    run.dataset === "labelled100"
      ? labelled.find((t) => t.ticket_id === id)!
      : null;
  const start = Date.now();
  const base = {
    ticket_id: id,
    expected: truth
      ? { category: truth.category, priority: truth.priority }
      : null,
    tags: truth?.tags || "",
  };
  try {
    // Only subject/body enter the prompt; labels, notes and tags never do.
    const input = TicketSchema.parse({
      ticket: ticket.subject + "\n\n" + ticket.body,
    });
    const output = await triage(input.ticket, run.model);
    return {
      ...base,
      predicted: output.result,
      status: 200,
      latency_ms: output.latency_ms,
      usage: output.usage,
      cost_usd: output.cost_usd,
    };
  } catch (error) {
    const e =
      error instanceof z.ZodError
        ? { status: 400, message: "Ticket exceeds input constraints." }
        : safeError(error);
    return {
      ...base,
      predicted: null,
      status: e.status,
      error: e.message,
      latency_ms: Date.now() - start,
      usage: null,
      cost_usd: null,
    };
  }
}
