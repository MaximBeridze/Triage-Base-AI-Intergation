"use client";
import { useState, type FormEvent } from "react";
import { DisplayResultSchema, type DisplayResult } from "../lib/schema";
import type { Usage } from "../lib/metrics";
import ModelPicker from "./model-picker";
export default function TriagePage() {
  const [ticket, setTicket] = useState("");
  const [model, setModel] = useState("");
  const [result, setResult] = useState<DisplayResult | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Triage failed.");
      setResult(DisplayResultSchema.parse(data.result));
      setUsage(data.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Triage failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">KESTREL / SUPPORT OPERATIONS</p>
          <h1>Ticket triage</h1>
          <p>Turn a customer request into a clear next step.</p>
        </div>
        <nav>
          <a href="/chat">Chat exercise</a>
          <a href="/triage-v1">Plain-text V1</a>
          <a href="/smoke">Smoke tests</a>
          <a href="/admin">Run history</a>
        </nav>
      </header>
      <div className="grid">
        <section className="card">
          <h2>Incoming request</h2>
          <form onSubmit={submit} aria-busy={busy}>
            <ModelPicker value={model} onChange={setModel} disabled={busy} />
            <label htmlFor="ticket">Subject and ticket body</label>
            <textarea
              id="ticket"
              rows={12}
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              maxLength={20000}
              placeholder="Paste a customer support ticket here…"
              disabled={busy}
            />
            <small>{ticket.length.toLocaleString()} / 20,000 characters</small>
            <button disabled={busy || !model} type="submit">
              {busy ? "Analysing…" : "Triage ticket →"}
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
        </section>
        <section className="card" aria-live="polite">
          <h2>Triage recommendation</h2>
          {result ? (
            <>
              <div className="badges">
                <span>{result.category.replaceAll("_", " ")}</span>
                <span className={result.priority}>
                  {result.priority} priority
                </span>
              </div>
              <h3>Summary</h3>
              <p>
                {result.summary ??
                  "Not generated: Clef is a classification-only decision model."}
              </p>
              <h3>Suggested action</h3>
              <p>
                {result.suggested_action ??
                  "Choose Gemini for a written next action. This result measures Clef alone."}
              </p>
              {"probabilities" in result && (
                <>
                  <h3>Decision probabilities</h3>
                  <p className="muted">
                    Model estimates, not guarantees of correctness.
                  </p>
                  <pre>{JSON.stringify(result.probabilities, null, 2)}</pre>
                </>
              )}
              <h3>Token usage</h3>
              <p>
                {usage
                  ? `Input: ${usage.input} · Output: ${usage.output} · Total: ${usage.total}`
                  : "Provider did not report token usage."}
              </p>
              <p className="muted">AI recommendation · Review before acting.</p>
            </>
          ) : (
            <p className="empty">
              {busy
                ? "Waiting for a validated model response…"
                : "Your ticket’s classification and next action will appear here."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
