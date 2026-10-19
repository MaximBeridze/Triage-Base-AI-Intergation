import { llm } from "../../../lib/llm";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("message" in body) ||
    typeof body.message !== "string" ||
    !body.message.trim()
  ) {
    return Response.json(
      { error: "Please provide a non-empty message string." },
      { status: 400 },
    );
  }

  try {
    const completion = await llm.chat.completions.create({
      model: process.env.LLM_MODEL!,
      messages: [
        { role: "system", content: "You are a helpful support assistant." },
        { role: "user", content: body.message },
      ],
    });

    const answer = completion.choices[0]?.message.content;

    if (!answer?.trim()) {
      return Response.json(
        { error: "The model returned an empty answer." },
        { status: 502 },
      );
    }

    return Response.json({ answer });
  } catch {
    return Response.json(
      { error: "Unable to reach the AI service. Please try again." },
      { status: 502 },
    );
  }
}
