"use client";
import { useState, type FormEvent } from "react";
import { TriageSchema, type TriageResult } from "../lib/schema";
export default function TriagePage() {
  const [ticket, setTicket] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/triage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Triage failed.");
      setResult(TriageSchema.parse(data.result));
    } catch (e) { setError(e instanceof Error ? e.message : "Triage failed."); }
    finally { setBusy(false); }
  }
  return <main>
    <header><div><p className="eyebrow">KESTREL / SUPPORT OPERATIONS</p><h1>Ticket triage</h1><p>Turn a customer request into a clear next step.</p></div><nav><a href="/chat">Chat exercise</a><a href="/smoke">Smoke tests</a><a href="/admin">Run history</a></nav></header>
    <div className="grid"><section className="card"><h2>Incoming request</h2><form onSubmit={submit} aria-busy={busy}>
      <label htmlFor="ticket">Subject and ticket body</label><textarea id="ticket" rows={12} value={ticket} onChange={e => setTicket(e.target.value)} maxLength={20000} placeholder="Paste a customer support ticket here…" disabled={busy} />
      <small>{ticket.length.toLocaleString()} / 20,000 characters</small><button disabled={busy} type="submit">{busy ? "Analysing…" : "Triage ticket →"}</button>
    </form>{error && <p role="alert">{error}</p>}</section>
    <section className="card" aria-live="polite"><h2>Triage recommendation</h2>{result ? <><div className="badges"><span>{result.category.replaceAll("_", " ")}</span><span className={result.priority}>{result.priority} priority</span></div><h3>Summary</h3><p>{result.summary}</p><h3>Suggested action</h3><p>{result.suggested_action}</p><p className="muted">AI recommendation · Review before acting.</p></> : <p className="empty">{busy ? "Waiting for a validated model response…" : "Your ticket’s classification and next action will appear here."}</p>}</section></div>
  </main>;
}

