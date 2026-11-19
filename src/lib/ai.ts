import "server-only";

// Pay-per-use model call over plain fetch (no SDK, no subscription).
// AI_PROVIDER=anthropic|openai, with ANTHROPIC_API_KEY or OPENAI_API_KEY, optional AI_MODEL.

export function aiConfigured() {
  const p = provider();
  return p === "anthropic" ? !!process.env.ANTHROPIC_API_KEY : !!process.env.OPENAI_API_KEY;
}

function provider() {
  return (process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "openai")).toLowerCase();
}

export function modelName() {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  return provider() === "anthropic" ? "claude-sonnet-5-5" : "gpt-4.1";
}

/** Returns the model's text. Throws with a readable message on any failure. */
export async function complete(system: string, user: string, maxTokens = 16000): Promise<string> {
  if (!aiConfigured()) throw new Error("No AI key configured. Add ANTHROPIC_API_KEY or OPENAI_API_KEY in your environment.");
  const model = modelName();

  if (provider() === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${json?.error?.message ?? "request failed"}`);
    return (json.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${json?.error?.message ?? "request failed"}`);
  return json.choices?.[0]?.message?.content ?? "";
}

/** Pull the first JSON object out of a model response. */
export function parseJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("Model did not return JSON.");
  return JSON.parse(text.slice(start, end + 1)) as T;
}
