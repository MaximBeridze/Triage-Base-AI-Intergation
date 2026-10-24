"use client";
import { useEffect, useState } from "react";
export default function ModelPicker({
  value,
  onChange,
  disabled,
  llmOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  llmOnly?: boolean;
}) {
  const [models, setModels] = useState<string[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/config")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        const choices: string[] = llmOnly
          ? d.models.filter((m: string) => !m.startsWith("@cf/cloudflare/clef"))
          : d.models;
        setModels(choices);
        onChange(
          choices.includes(d.defaultModel) ? d.defaultModel : choices[0] || "",
        );
      })
      .catch(() => setError("Unable to load model configuration."));
  }, []); // configuration loads once
  return (
    <label>
      Strategy and model
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !models.length}
      >
        {!models.length && <option value="">Loading…</option>}
        {models.map((m) => (
          <option key={m} value={m}>
            {m.startsWith("@cf/cloudflare/clef")
              ? "DM · classify"
              : "LLM · generate"}{" "}
            — {m}
          </option>
        ))}
      </select>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
