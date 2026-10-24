import { llm } from "../../../lib/llm";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return Response.json(
      { error: "Please provide a non-empty messages array." },
      { status: 400 },
    );
  }

  if (
    !("messages" in body) ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0
  ) {
    return Response.json(
      { error: "messages must be an array." },
      { status: 400 },
    );
  }

  const messages: {
    role: "user" | "assistant";
    content: string;
  }[] = [];

  for (const item of body.messages) {
     if (
        typeof item !== "object" ||
        item === null ||
        (item.role !== "user" && item.role !== "assistant") ||
        typeof item.content !== "string" ||
        !item.content.trim()
      ) {
      return Response.json(
        { error: "Each message must have a user or assistant role and non-empty content." },
        { status: 400 },
      );
    }

    messages.push({
      role: item.role,
      content: item.content,
    });
  }

  try {
    const completion = await llm.chat.completions.create({
      model: process.env.LLM_MODEL!,
      messages: [
        { role: "system", content: "You are a helpful support assistant." },
        ...messages,
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
  } catch (error) {
    console.error("AI request failed:", {
      type: error instanceof Error ? error.name : "Unknown",
      status:
        typeof error === "object" &&
        error !== null &&
        "status" in error
          ? error.status
          : "No HTTP status",
    });

    return Response.json(
      { error: "Unable to reach the AI service. Please try again." },
      { status: 502 },
    );
  };
}