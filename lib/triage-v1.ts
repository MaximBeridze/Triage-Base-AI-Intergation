import { llm } from "./llm";
import { AppError, safeError } from "./errors";
import { usageFrom, costFor } from "./metrics";
import { logCall } from "./storage";
import { V1_PROMPT, V1_PROMPT_VERSION } from "./prompt";

// The historical V1 checkpoint deliberately returns free text; V2 validates structured output.
export async function triageV1(ticket: string, model: string) {
  const start = Date.now();
  try {
    const completion = await llm.chat.completions.create({
      model,
      messages: [
        { role: "system", content: V1_PROMPT },
        { role: "user", content: `<ticket>${ticket}</ticket>` },
      ],
    });
    const choice = completion.choices[0];
    if (!choice?.message.content?.trim() || choice.finish_reason !== "stop")
      throw new AppError(
        502,
        "invalid_model_output",
        "The model returned an empty or incomplete V1 answer.",
      );
    const usage = usageFrom(completion.usage);
    const result = {
      answer: choice.message.content,
      model,
      usage,
      latency_ms: Date.now() - start,
      cost_usd: costFor(usage),
    };
    await logCall({
      ts: new Date().toISOString(),
      route: "triage_v1",
      api: "chat_completions",
      strategy: "llm",
      prompt_version: V1_PROMPT_VERSION,
      model,
      status: 200,
      usage,
      latency_ms: result.latency_ms,
      cost_usd: result.cost_usd,
    });
    return result;
  } catch (error) {
    const failure = safeError(error);
    await logCall({
      ts: new Date().toISOString(),
      route: "triage_v1",
      api: "chat_completions",
      strategy: "llm",
      prompt_version: V1_PROMPT_VERSION,
      model,
      status: failure.status,
      code: failure.code,
    });
    throw failure;
  }
}
