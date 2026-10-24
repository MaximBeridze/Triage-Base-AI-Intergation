"use client";
import { useEffect, useState } from "react";
export default function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
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
        setModels(d.models);
        onChange(d.defaultModel);
      })
      .catch(() => setError("Unable to load model configuration."));
  }, []); // configuration loads once
  return (
    <label>
      Model
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !models.length}
      >
        {!models.length && <option value="">Loading…</option>}
        {models.map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>
      {error && <small role="alert">{error}</small>}
    </label>
  );
}
