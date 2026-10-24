import OpenAI from "openai";
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function safeError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new AppError(504, "triage_timeout", "The model timed out. Try again later.");
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429) return new AppError(429, "rate_limited", "Provider quota reached. Wait and retry, or choose another available model.");
    if (error.status && [400, 401, 403, 404].includes(error.status)) return new AppError(500, "internal_error", "Check the server key, endpoint, model and output mode configuration.");
  }
  return new AppError(502, "triage_unavailable", "The AI service is unavailable. Please try again later.");
}
export function errorResponse(error: unknown) {
  const e = safeError(error);
  return Response.json({ error: e.message, code: e.code }, { status: e.status });
}
