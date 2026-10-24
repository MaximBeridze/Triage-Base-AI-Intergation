"use client";
import { useState, type FormEvent } from "react";
import type { Run } from "../../lib/runs";
import ModelPicker from "../model-picker";
export default function SmokePage() {
  const [dataset, setDataset] = useState("labelled100"),
    [count, setCount] = useState(5);
  const [model, setModel] = useState(""),
    [replay, setReplay] = useState(false);
  const [run, setRun] = useState<Run | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function start(e: FormEvent) {
    e.preventDefault();
    const replayId = replay ? run?.id : undefined;
    setBusy(true);
    setRun(null);
    setError("");
    try {
      const response = await fetch("/api/smoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataset, count, model, replay: replayId }),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).error || "Unable to start run.",
        );
      const reader = response.body!.getReader(),
        decoder = new TextDecoder();
      let buffer = "",
        finished = false;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let end: number;
        while ((end = buffer.indexOf("\n")) >= 0) {
          const event = JSON.parse(buffer.slice(0, end));
          buffer = buffer.slice(end + 1);
          if (event.error) throw new Error(event.error);
          if (event.run) setRun(event.run);
          if (event.type === "done") finished = true;
        }
      }
      if (!finished)
        throw new Error("Connection interrupted. The run may be incomplete.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">KESTREL / EVALUATION</p>
          <h1>Smoke test runner</h1>
          <p>Random samples. Visible predictions. Measurable quality.</p>
        </div>
        <nav>
          <a href="/">Triage</a>
          <a href="/admin">Run history</a>
        </nav>
      </header>
      <section className="card">
        <form className="toolbar" onSubmit={start}>
          <ModelPicker value={model} onChange={setModel} disabled={busy} />
          <label>
            Dataset
            <select
              value={dataset}
              disabled={busy}
              onChange={(e) => {
                setDataset(e.target.value);
                setCount(5);
                setReplay(false);
              }}
            >
              <option value="labelled100">100 labelled tickets</option>
              <option value="tickets500">500 unlabelled tickets</option>
            </select>
          </label>
          <label>
            Sample size
            <input
              type="number"
              min={1}
              max={dataset === "labelled100" ? 100 : 500}
              value={count}
              disabled={busy}
              onChange={(e) => setCount(Number(e.target.value))}
              required
            />
          </label>
          <button disabled={busy || !model}>
            {busy ? "Running…" : "Run sample →"}
          </button>
        </form>
        {run && !busy && (
          <label>
            <input
              type="checkbox"
              checked={replay}
              onChange={(e) => setReplay(e.target.checked)}
            />{" "}
            Reuse this exact sample for the next model (keep dataset and count
            unchanged)
          </label>
        )}
        <p className="muted">
          Calls run sequentially with a delay to respect provider limits. Keep
          this page open. A quota or configuration failure stops the run.
        </p>
        {error && <p role="alert">{error}</p>}
      </section>
      {run && (
        <section className="card" aria-live="polite">
          <h2>
            {run.model} · {run.state}
          </h2>
          <progress value={run.rows.length} max={run.requested} />
          <p>
            {run.rows.length} / {run.requested} processed ·{" "}
            {run.summary.succeeded} successful
          </p>
          {run.dataset === "labelled100" ? (
            <div className="stats">
              <div className="stat">
                <strong>{run.summary.category_mismatches}</strong>Category
                mismatches
              </div>
              <div className="stat">
                <strong>{run.summary.priority_mismatches}</strong>Priority
                mismatches
              </div>
            </div>
          ) : (
            <p>
              No ground-truth labels: accuracy is unavailable for this dataset.
            </p>
          )}
          <p className="muted">
            Failed predictions count as mismatches. During a run, totals cover
            processed tickets only.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Outcome</th>
                  <th>Category predicted / expected</th>
                  <th>Priority predicted / expected</th>
                  <th>Latency</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {run.rows.map((r) => (
                  <tr key={r.ticket_id}>
                    <td>{r.ticket_id}</td>
                    <td>
                      {r.status}
                      {r.error && <p>{r.error}</p>}
                    </td>
                    <td
                      className={
                        r.expected &&
                        r.expected.category !== r.predicted?.category
                          ? "mismatch"
                          : ""
                      }
                    >
                      {r.predicted?.category || "—"} /{" "}
                      {r.expected?.category || "unlabelled"}
                    </td>
                    <td
                      className={
                        r.expected &&
                        r.expected.priority !== r.predicted?.priority
                          ? "mismatch"
                          : ""
                      }
                    >
                      {r.predicted?.priority || "—"} /{" "}
                      {r.expected?.priority || "unlabelled"}
                    </td>
                    <td>{(r.latency_ms / 1000).toFixed(1)}s</td>
                    <td>{r.usage?.total ?? "unavailable"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Confusion matrices (expected → predicted)</summary>
            <pre>
              {JSON.stringify(
                {
                  category: run.summary.category_matrix,
                  priority: run.summary.priority_matrix,
                },
                null,
                2,
              )}
            </pre>
          </details>
        </section>
      )}
    </main>
  );
}
