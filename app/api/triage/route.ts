import { TicketSchema, requestJsonSchema, responseJsonSchema } from "../../../lib/schema";
import { triage } from "../../../lib/triage";
import { errorResponse } from "../../../lib/errors";
export function GET() { return Response.json({ request: requestJsonSchema, response: responseJsonSchema }); }
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const parsed = TicketSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: parsed.error.issues.map(i => `${i.path.join(".") || "request"}: ${i.message}`).join("; ") }, { status: 400 });
  try { return Response.json(await triage(parsed.data.ticket)); } catch (error) { return errorResponse(error); }
}
