import { AppError } from "./errors";
import { DECISION_MODEL } from "./decision";
export function availableModels() {
  return [
    ...new Set(
      [
        process.env.LLM_MODEL,
        ...(process.env.LLM_MODELS || "").split(","),
        ...(process.env.CLOUDFLARE_ACCOUNT_ID &&
        process.env.CLOUDFLARE_API_TOKEN
          ? [DECISION_MODEL]
          : []),
      ]
        .map((s) => s?.trim())
        .filter((s): s is string => Boolean(s)),
    ),
  ];
}
export function chooseModel(model?: string) {
  const chosen = model || process.env.LLM_MODEL;
  if (!chosen || !availableModels().includes(chosen))
    throw new AppError(
      400,
      "invalid_model",
      "Choose a model from the configured list.",
    );
  return chosen;
}
