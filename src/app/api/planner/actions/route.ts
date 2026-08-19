import type { PlannerAction, PlannerProposal, Weekday } from "@/types";

export const runtime = "nodejs";

const weekdays: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const actionTypes = ["replaceMeal", "swapDays", "moveMeal", "combineMealComponents", "removeMeal", "optimizeWeek", "changeMealConstraint"];
const objectives = ["balanced", "lowest-cost", "least-waste", "fastest", "highest-protein", "most-variety"];
const constraints = ["vegetarian", "under-20-minutes", "high-protein", "no-pasta"];

const plannerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "needsConfirmation", "clarification", "actions"],
  properties: {
    summary: { type: "string" },
    needsConfirmation: { type: "boolean" },
    clarification: { type: ["string", "null"] },
    actions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "targetDay", "sourceDay", "destinationDay", "mainFromDay", "sideFromDay", "objective", "constraint"],
        properties: {
          type: { type: "string", enum: actionTypes },
          targetDay: { type: ["string", "null"], enum: [...weekdays, null] },
          sourceDay: { type: ["string", "null"], enum: [...weekdays, null] },
          destinationDay: { type: ["string", "null"], enum: [...weekdays, null] },
          mainFromDay: { type: ["string", "null"], enum: [...weekdays, null] },
          sideFromDay: { type: ["string", "null"], enum: [...weekdays, null] },
          objective: { type: ["string", "null"], enum: [...objectives, null] },
          constraint: { type: ["string", "null"], enum: [...constraints, null] },
        },
      },
    },
  },
} as const;

function extractOutputText(response: unknown) {
  if (!response || typeof response !== "object" || !("output" in response)) return undefined;
  const output = (response as { output?: { content?: { type?: string; text?: string }[] }[] }).output;
  return output?.flatMap((item) => item.content ?? []).find((item) => item.type === "output_text")?.text;
}

function mentionedDays(instruction: string) {
  const normalized = instruction.toLowerCase();
  return weekdays
    .map((day) => ({ day, index: normalized.indexOf(day.toLowerCase()) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.day);
}

function fallbackProposal(instruction: string): PlannerProposal {
  const text = instruction.toLowerCase();
  const days = mentionedDays(instruction);
  if ((text.includes("salmon") && text.includes("potato")) || text.includes("combine")) {
    if (days.length < 2) return { summary: "I need two days to combine meal components.", needsConfirmation: false, clarification: "Which day has the main component, and which day has the side?", actions: [] };
    return { summary: `Change ${days[0]} to use its main with ${days[1]}'s side?`, needsConfirmation: true, actions: [{ type: "combineMealComponents", targetDay: days[0], mainFromDay: days[0], sideFromDay: days[1] }] };
  }
  if (text.includes("swap")) {
    if (days.length < 2) return { summary: "I need two days to swap.", needsConfirmation: false, clarification: "Which two days would you like to swap?", actions: [] };
    return { summary: `Swap ${days[0]} and ${days[1]}?`, needsConfirmation: true, actions: [{ type: "swapDays", sourceDay: days[0], destinationDay: days[1] }] };
  }
  if (text.includes("move")) {
    if (days.length < 2) return { summary: "I need a starting day and destination.", needsConfirmation: false, clarification: "Which meal should move, and to which day?", actions: [] };
    return { summary: `Move ${days[0]}'s meal to ${days[1]}?`, needsConfirmation: true, actions: [{ type: "moveMeal", sourceDay: days[0], destinationDay: days[1] }] };
  }
  if (text.includes("remove")) {
    if (!days[0]) return { summary: "I need a day to remove.", needsConfirmation: false, clarification: "Which day should be left open?", actions: [] };
    return { summary: `Remove ${days[0]}'s meal?`, needsConfirmation: true, actions: [{ type: "removeMeal", targetDay: days[0] }] };
  }
  const constraint = text.includes("vegetarian") ? "vegetarian" : text.includes("20 minute") || text.includes("20-minute") || text.includes("under 20") ? "under-20-minutes" : text.includes("high protein") ? "high-protein" : text.includes("pasta") ? "no-pasta" : undefined;
  if (constraint && days[0]) return { summary: `Find a ${constraint.replaceAll("-", " ")} meal for ${days[0]}?`, needsConfirmation: true, actions: [{ type: "changeMealConstraint", targetDay: days[0], constraint }] };
  const objective = text.includes("cheap") || text.includes("cost") ? "lowest-cost" : text.includes("fast") ? "fastest" : text.includes("protein") ? "highest-protein" : text.includes("variety") || text.includes("pasta twice") ? "most-variety" : text.includes("waste") || text.includes("already have") || text.includes("pantry") ? "least-waste" : undefined;
  if (objective) return { summary: `Re-optimize the week for ${objective.replaceAll("-", " ")}?`, needsConfirmation: true, actions: [{ type: "optimizeWeek", objective }] };
  if (days[0]) return { summary: `Replace ${days[0]}'s meal?`, needsConfirmation: true, actions: [{ type: "replaceMeal", targetDay: days[0] }] };
  return { summary: "I need one more detail before changing the plan.", needsConfirmation: false, clarification: "Mention a day and what you want changed—for example, “Make Wednesday vegetarian.”", actions: [] };
}

function normalizeProposal(value: PlannerProposal & { clarification?: string | null }) {
  return {
    ...value,
    clarification: value.clarification ?? undefined,
    actions: value.actions.map((action) => Object.fromEntries(Object.entries(action).filter(([, field]) => field !== null)) as unknown as PlannerAction),
  } satisfies PlannerProposal;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => undefined) as { instruction?: string; plan?: unknown; household?: unknown } | undefined;
  if (!body?.instruction?.trim()) return Response.json({ message: "An instruction is required." }, { status: 400 });
  const fallback = fallbackProposal(body.instruction);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ proposal: fallback, mode: "fallback" });
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: process.env.OPENAI_RECIPE_MODEL?.trim() || "gpt-4o-mini",
        input: [
          { role: "developer", content: "Translate the user's request into only the allowed meal-planner actions. Never invent days or meals. Allergies and dietary rules are immutable hard constraints. Use clarification with no actions whenever the request is ambiguous. Meaningful changes require confirmation." },
          { role: "user", content: JSON.stringify({ instruction: body.instruction, currentWeek: body.plan, household: body.household }) },
        ],
        text: { format: { type: "json_schema", name: "planner_actions", strict: true, schema: plannerSchema } },
      }),
    });
    if (!response.ok) throw new Error(`Planner request failed with ${response.status}`);
    const outputText = extractOutputText(await response.json() as unknown);
    if (!outputText) throw new Error("No planner output");
    return Response.json({ proposal: normalizeProposal(JSON.parse(outputText) as PlannerProposal), mode: "openai" });
  } catch (error) {
    console.error("Planner action generation failed", error);
    return Response.json({ proposal: fallback, mode: "fallback", recovered: true });
  }
}
