"use client";
import { useState, type FormEvent } from "react";
import ModelPicker from "../model-picker";
export default function PlainTriage() {
  const [ticket, setTicket] = useState(""),
    [model, setModel] = useState(""),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAnswer("");
    setError("");
    try {
      const response = await fetch("/api/triage/v1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, model }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "V1 request failed.");
      if (typeof data.answer !== "string")
        throw new Error("Invalid server response.");
      setAnswer(data.answer);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">KESTREL / SUPPORT OPERATIONS</p>
          <h1>Plain-text triage V1</h1>
          <p>Ticket classification and recommendations in plain text.</p>
        </div>
        <nav>
          <a href="/">Structured V2</a>
          <a href="/chat">Chat</a>
          <a href="/smoke">Smoke tests</a>
        </nav>
      </header>
      <div className="grid">
        <section className="card">
          <form onSubmit={submit} aria-busy={busy}>
            <ModelPicker
              value={model}
              onChange={setModel}
              disabled={busy}
              llmOnly
            />
            <label htmlFor="ticket">Subject and ticket body</label>
            <textarea
              id="ticket"
              rows={10}
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              maxLength={20000}
              disabled={busy}
            />
            <button disabled={busy || !model}>
              {busy ? "Analysing…" : "Run plain-text V1"}
            </button>
          </form>
          {error && <p role="alert">{error}</p>}
        </section>
        <section className="card" aria-live="polite">
          <h2>Unstructured answer</h2>
          <p className="muted">
            The answer’s classification fields are not schema-validated here.
            Use V2 for validated results and evaluation.
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {answer || "Your plain-text result will appear here."}
          </p>
        </section>
      </div>
    </main>
  );
}
