import {
  RunRequestSchema,
  createRun,
  evaluateTicket,
  summarize,
} from "../../../lib/runs";
import { saveRun, listRuns } from "../../../lib/storage";
import { chooseModel } from "../../../lib/config";
import { errorResponse } from "../../../lib/errors";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = RunRequestSchema.safeParse(body);
  if (
    !parsed.success ||
    (parsed.data.dataset === "labelled100" && parsed.data.count > 100)
  )
    return Response.json(
      { error: "Choose a valid dataset and sample size." },
      { status: 400 },
    );
  let model: string;
  try {
    model = chooseModel(parsed.data.model);
  } catch (e) {
    return errorResponse(e);
  }
  const replay = parsed.data.replay
    ? (await listRuns()).find((r) => r.id === parsed.data.replay)
    : undefined;
  if (
    parsed.data.replay &&
    (!replay ||
      replay.dataset !== parsed.data.dataset ||
      replay.requested !== parsed.data.count)
  )
    return Response.json(
      { error: "Replay must use the original dataset and sample size." },
      { status: 400 },
    );
  const run = createRun(
    parsed.data.dataset,
    parsed.data.count,
    model,
    replay?.ticket_ids,
  );
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let connected = true;
      const send = (value: unknown) => {
        if (connected) {
          try {
            controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
          } catch {
            connected = false;
          }
        }
      };
      try {
        await saveRun(run);
        send({ type: "start", run });
        for (const id of run.ticket_ids) {
          if (request.signal.aborted || !connected) break;
          run.rows.push(await evaluateTicket(run, id));
          run.summary = summarize(run.rows);
          await saveRun(run);
          send({ type: "progress", run });
          // Stop a quota/configuration failure rather than spending the entire sample on it.
          if ([429, 500].includes(run.rows.at(-1)!.status)) break;
          const delay = Number(process.env.SMOKE_DELAY_MS || "4500");
          if (run.rows.length < run.requested)
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                Number.isFinite(delay) ? Math.max(0, delay) : 4500,
              ),
            );
        }
        run.state =
          run.rows.length === run.requested ? "complete" : "interrupted";
        await saveRun(run);
        send({ type: "done", run });
      } catch (error) {
        console.error("Smoke run interrupted", {
          name: error instanceof Error ? error.name : "Unknown",
          code:
            typeof error === "object" && error !== null && "code" in error
              ? String(error.code)
              : "unknown",
        });
        run.state = "interrupted";
        await saveRun(run).catch(() => {});
        send({
          type: "error",
          error:
            "The smoke run could not finish or be saved. Check server storage permissions.",
        });
      } finally {
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
