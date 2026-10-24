import { llm } from "./llm";
import { TriageSchema, responseJsonSchema } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";
import { AppError } from "./errors";
import { usageFrom, costFor, type Usage } from "./metrics";
import { logCall } from "./storage";
import { PROMPT_VERSION } from "./prompt";

export async function triage(ticket: string, model = process.env.LLM_MODEL!) {
  const started = Date.now();
  let usage: Usage | null = { input: 0, output: 0, total: 0 };
  const mode = process.env.LLM_STRUCTURED_OUTPUT || "json_schema";
  if (!["json_schema", "prompt"].includes(mode)) throw new AppError(500, "internal_error", "Invalid output configuration.");
  for (let attempt = 0; attempt < 2; attempt++) {
    const completion = await llm.chat.completions.create({
      model,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: `<ticket>${ticket}</ticket>` }],
      ...(mode === "json_schema" ? { response_format: {
        type: "json_schema" as const,
        json_schema: { name: "support_triage", strict: true, schema: responseJsonSchema },
      } } : {}),
    });
    const choice = completion.choices[0];
    const current = usageFrom(completion.usage);
    usage = usage && current ? { input: usage.input + current.input, output: usage.output + current.output, total: usage.total + current.total } : null;
    await logCall({ ts: new Date().toISOString(), route: "triage", api: "chat_completions", prompt_version: PROMPT_VERSION, model, attempt: attempt + 1, usage: current, cost_usd: costFor(current), finish_reason: choice?.finish_reason ?? null });
    let text = choice?.message.content ?? "";
    if (mode === "prompt") text = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    try {
      if (!choice || choice.finish_reason !== "stop") throw new Error("Incomplete output");
      const result = TriageSchema.parse(JSON.parse(text));
      return { result, model, latency_ms: Date.now() - started, usage, cost_usd: costFor(usage) };
    } catch {
      if (attempt === 1) throw new AppError(502, "invalid_model_output", "The model returned an invalid result after one retry.");
    }
  }
  throw new AppError(502, "invalid_model_output", "Invalid model output.");
}
