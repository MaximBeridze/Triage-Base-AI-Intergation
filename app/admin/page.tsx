import { listRuns } from "../../lib/storage";
export const dynamic = "force-dynamic";
const percent = (n: number | null) => n === null ? "N/A" : `${(n*100).toFixed(1)}%`;
export default async function AdminPage() {
  const runs = await listRuns();
  return <main><header><div><p className="eyebrow">KESTREL / RUN HISTORY</p><h1>Evaluation ledger</h1><p>Saved model runs, quality and operational cost.</p></div><nav><a href="/">Triage</a><a href="/smoke">New smoke test</a></nav></header>
    <section className="card"><h2>{runs.length} saved runs</h2><p className="muted">Accuracy covers processed labelled tickets; failed calls count as incorrect. Cost is an estimate in USD; unavailable means usage or configured prices are missing. Reload to update active runs.</p>
    {!runs.length ? <p>No runs yet. Start a smoke test to create one.</p> : <div className="table-wrap"><table><thead><tr><th>Created / run</th><th>Model / prompt</th><th>Dataset / state</th><th>Outcomes</th><th>Category accuracy</th><th>Priority accuracy</th><th>Mean latency</th><th>Cost USD</th></tr></thead><tbody>{runs.map(r=><tr key={r.id}><td>{r.created_at}<br/><a href={`/api/runs/${r.id}`}>Download JSON</a></td><td>{r.model}<br/>{r.prompt_version}</td><td>{r.dataset}<br/>{r.state} · {r.rows.length}/{r.requested}</td><td>{Object.entries(r.summary.outcomes).map(([s,n])=><div key={s}>{s}: {n}</div>)}</td><td>{percent(r.summary.category_accuracy)}</td><td>{percent(r.summary.priority_accuracy)}</td><td>{(r.summary.mean_latency_ms/1000).toFixed(2)}s</td><td>{r.summary.cost_usd===null?"unavailable":r.summary.cost_usd.toFixed(6)}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
