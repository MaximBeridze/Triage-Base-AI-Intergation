import { listRuns } from "../../../../lib/storage";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = (await listRuns()).find(r => r.id === id);
  if (!run) return Response.json({error:"Run not found."},{status:404});
  return Response.json(run,{headers:{"Content-Disposition":`attachment; filename="${run.id}.json"`,"Cache-Control":"no-store"}});
}
