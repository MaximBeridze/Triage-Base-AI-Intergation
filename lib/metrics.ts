export type Usage = { input: number; output: number; total: number };
export function usageFrom(
  value:
    | { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    | undefined,
): Usage | null {
  return value
    ? {
        input: value.prompt_tokens,
        output: value.completion_tokens,
        total: value.total_tokens,
      }
    : null;
}
export function costFor(usage: Usage | null): number | null {
  const input = process.env.LLM_INPUT_PRICE_PER_MILLION;
  const output = process.env.LLM_OUTPUT_PRICE_PER_MILLION;
  if (
    !usage ||
    input === undefined ||
    output === undefined ||
    input.trim() === "" ||
    output.trim() === ""
  )
    return null;
  const prices = [Number(input), Number(output)];
  if (prices.some((n) => !Number.isFinite(n) || n < 0)) return null;
  return (usage.input * prices[0] + usage.output * prices[1]) / 1000000;
}
