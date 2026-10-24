import { availableModels } from "../../../lib/config";
export function GET() { return Response.json({ models: availableModels(), defaultModel: process.env.LLM_MODEL }); }
