import { TicketSchema } from "../../../../lib/schema";
import { chooseModel } from "../../../../lib/config";
import { DECISION_MODEL } from "../../../../lib/decision";
import { triageV1 } from "../../../../lib/triage-v1";
import { errorResponse, AppError } from "../../../../lib/errors";
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = TicketSchema.safeParse(body);
  if (!parsed.success)
    return Response.json(
      { error: "Enter a ticket of 1–20,000 characters and an allowed model." },
      { status: 400 },
    );
  try {
    const model = chooseModel(parsed.data.model);
    if (model === DECISION_MODEL)
      throw new AppError(
        400,
        "invalid_model",
        "V1 requires a text-generating LLM. Use structured triage for Clef.",
      );
    return Response.json(await triageV1(parsed.data.ticket, model));
  } catch (error) {
    return errorResponse(error);
  }
}
