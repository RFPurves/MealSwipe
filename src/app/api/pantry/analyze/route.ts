export const runtime = "nodejs";

const pantrySchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "note"],
  properties: {
    items: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: false, required: ["name", "confidence"], properties: { name: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low"] } } } },
    note: { type: "string" },
  },
} as const;

function extractOutputText(response: unknown) {
  if (!response || typeof response !== "object" || !("output" in response)) return undefined;
  const output = (response as { output?: { content?: { type?: string; text?: string }[] }[] }).output;
  return output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined) as { imageDataUrl?: string } | undefined;
  if (!body?.imageDataUrl?.startsWith("data:image/") || body.imageDataUrl.length > 6_000_000) {
    return Response.json({ message: "Upload a pantry image smaller than 4 MB." }, { status: 400 });
  }
  const fallback = { items: ["eggs", "spinach", "tomatoes", "rice"].map((name) => ({ name, confidence: "low" })), note: "Photo analysis is unavailable, so these demo suggestions need careful confirmation." };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ result: fallback, mode: "fallback" });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(18000),
      body: JSON.stringify({
        model: process.env.OPENAI_RECIPE_MODEL?.trim() || "gpt-4o-mini",
        input: [{ role: "user", content: [{ type: "input_text", text: "List only likely edible pantry or fridge ingredients visible in this image. Be conservative. Do not infer hidden items. The user will confirm everything." }, { type: "input_image", image_url: body.imageDataUrl, detail: "low" }] }],
        text: { format: { type: "json_schema", name: "pantry_items", strict: true, schema: pantrySchema } },
      }),
    });
    if (!response.ok) {
      const errorPayload = await response.json().catch(() => undefined) as
        | { error?: { type?: string; code?: string; param?: string; message?: string } }
        | undefined;
      console.error("OpenAI pantry request rejected", {
        status: response.status,
        type: errorPayload?.error?.type,
        code: errorPayload?.error?.code,
        param: errorPayload?.error?.param,
      });
      throw new Error(`Image analysis failed with ${response.status}`);
    }
    const outputText = extractOutputText(await response.json() as unknown);
    if (!outputText) throw new Error("No image analysis output");
    return Response.json({ result: JSON.parse(outputText), mode: "openai" });
  } catch (error) {
    console.error("Pantry image analysis failed", error);
    return Response.json({ result: fallback, mode: "fallback", recovered: true });
  }
}
