"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightLeft,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Heart,
  ImagePlus,
  LoaderCircle,
  Mic,
  MicOff,
  MoveRight,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Repeat2,
  Send,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Trash2,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import { useMealApp, type PlanningScope } from "@/components/app-provider";
import { mealById } from "@/data/meals";
import {
  buildShoppingList,
  createCombinedMeal,
  findReplacementMeal,
  formatShoppingAmount,
  generateWeeklyPlan,
  getIngredientReuseStats,
  getSafeMealPool,
  SHOPPING_CATEGORY_ORDER,
  WEEKDAYS,
} from "@/lib/meal-planner";
import { mealIsSafeForHousehold, mealSafetyForHousehold } from "@/lib/meal-safety";
import type { Meal, OptimizationObjective, PlannerAction, PlannerProposal, ShoppingCategory, Weekday } from "@/types";

const categoryIcons: Record<ShoppingCategory, string> = { Produce: "🥬", Protein: "🥚", Dairy: "🥛", Grains: "🌾", Pantry: "🫙", Other: "✦" };
const objectiveLabels: Record<OptimizationObjective, string> = {
  balanced: "Balanced",
  "lowest-cost": "Lowest cost",
  "least-waste": "Least waste",
  fastest: "Fastest cooking",
  "highest-protein": "Highest protein",
  "most-variety": "Most variety",
};

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dayIndex(day?: Weekday) {
  return day ? WEEKDAYS.indexOf(day) : -1;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export function WeekPlanner({ scope = "personal" }: { scope?: PlanningScope }) {
  const app = useMealApp();
  const isHousehold = scope === "household";
  const preferences = app.preferences;
  const household = useMemo(() => isHousehold ? app.household : ({
    name: "My plan",
    members: [{ id: app.account?.user.id ?? "me", name: app.account?.user.name ?? "You", username: app.account?.user.username ?? undefined, dietary: preferences.dietary, allergies: preferences.allergies, dislikedIngredients: preferences.dislikedIngredients, nutritionPreference: preferences.nutritionPreference ?? "Balanced" }],
    settings: { adults: 1, children: 0, dinnersPerWeek: preferences.personalDinnersPerWeek ?? 7, maximumCookingTime: preferences.maximumCookingTime ?? 45 },
  }), [app.account?.user, app.household, isHousehold, preferences]);
  const savedIds = app.savedIds;
  const weeklyPlanIds = isHousehold ? app.householdWeeklyPlanIds : app.weeklyPlanIds;
  const planRevision = isHousehold ? app.householdPlanRevision : app.planRevision;
  const dynamicMeals = isHousehold ? app.householdDynamicMeals : app.dynamicMeals;
  const checkedShoppingItems = isHousehold ? app.householdCheckedShoppingItems : app.checkedShoppingItems;
  const optimizationObjective = isHousehold ? app.householdOptimizationObjective : app.optimizationObjective;
  const pantryItems = isHousehold ? app.householdPantryItems : app.pantryItems;
  const usePantryFirst = isHousehold ? app.householdUsePantryFirst : app.usePantryFirst;
  const lastPlanChange = isHousehold ? app.householdLastPlanChange : app.lastPlanChange;
  const [isGenerating, setIsGenerating] = useState(false);
  const [replacingDay, setReplacingDay] = useState<number | null>(null);
  const [editorDay, setEditorDay] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<"swap" | "move" | "combine" | null>(null);
  const [instruction, setInstruction] = useState("");
  const [assistantStatus, setAssistantStatus] = useState<string | null>(null);
  const [proposal, setProposal] = useState<PlannerProposal | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [pantryInput, setPantryInput] = useState("");
  const [pantryStatus, setPantryStatus] = useState<string | null>(null);
  const [isSavingPantry, setIsSavingPantry] = useState(false);
  const [editingPantryId, setEditingPantryId] = useState<string | null>(null);
  const [pantryDraftName, setPantryDraftName] = useState("");
  const [pantryDraftQuantity, setPantryDraftQuantity] = useState("");
  const [pantryDraftUnit, setPantryDraftUnit] = useState("");
  const [photoItems, setPhotoItems] = useState<string[]>([]);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const generationTimer = useRef<number | undefined>(undefined);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => {
    if (generationTimer.current !== undefined) window.clearTimeout(generationTimer.current);
    recognitionRef.current?.stop();
  }, []);

  const dynamicById = useMemo(() => new Map(dynamicMeals.map((meal) => [meal.id, meal])), [dynamicMeals]);
  const resolveMeal = useCallback(
    (id: string | null | undefined) => id ? dynamicById.get(id) ?? mealById.get(id) : undefined,
    [dynamicById],
  );
  const planSlots = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const meal = resolveMeal(weeklyPlanIds[index]);
    return meal && mealIsSafeForHousehold(meal, household) ? meal : null;
  }), [household, resolveMeal, weeklyPlanIds]);
  const incompatiblePlanCount = useMemo(() => weeklyPlanIds.filter((id) => { const meal = resolveMeal(id); return meal && !mealIsSafeForHousehold(meal, household); }).length, [household, resolveMeal, weeklyPlanIds]);
  const planEntries = useMemo(() => planSlots.flatMap((meal, index) => meal ? [{ meal, day: WEEKDAYS[index] }] : []), [planSlots]);
  const planMeals = useMemo(() => planEntries.map((entry) => entry.meal), [planEntries]);
  const planDays = useMemo(() => planEntries.map((entry) => entry.day), [planEntries]);
  const safeMeals = useMemo(() => getSafeMealPool(preferences, dynamicMeals, household), [dynamicMeals, household, preferences]);
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const checkedItems = useMemo(() => new Set(checkedShoppingItems), [checkedShoppingItems]);
  const safeSavedCount = useMemo(() => savedIds.filter((id) => { const meal = resolveMeal(id); return meal ? mealIsSafeForHousehold(meal, household) : false; }).length, [household, resolveMeal, savedIds]);
  const reuseStats = useMemo(() => getIngredientReuseStats(planMeals), [planMeals]);
  const shoppingList = useMemo(() => buildShoppingList(planMeals, pantryItems, planDays), [pantryItems, planDays, planMeals]);
  const neededShoppingItems = useMemo(() => shoppingList.filter((item) => !item.inPantry), [shoppingList]);
  const groupedShopping = useMemo(() => SHOPPING_CATEGORY_ORDER.map((category) => ({ category, items: shoppingList.filter((item) => item.category === category) })).filter((group) => group.items.length > 0), [shoppingList]);
  const servings = Math.max(1, household.settings.adults + Math.ceil(household.settings.children / 2));

  const generate = (objective = optimizationObjective, summary = "Week regenerated and re-optimized") => {
    if (safeMeals.length === 0 || isGenerating) return;
    setIsGenerating(true);
    if (generationTimer.current !== undefined) window.clearTimeout(generationTimer.current);
    generationTimer.current = window.setTimeout(() => {
      void (async () => {
        let mealIds: (string | null)[] | null = null;
        if (app.account && (!isHousehold || app.account.household?.id) && !app.demoMode) {
          try {
            const response = await fetch(isHousehold ? "/api/households/plan" : "/api/account/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ objective, usePantryFirst }) });
            const data = await response.json() as { planIds?: (string | null)[] };
            if (response.ok && data.planIds) mealIds = data.planIds;
          } catch { /* Fall back to the same deterministic on-device planner. */ }
        }
        mealIds ??= generateWeeklyPlan(savedIds, preferences, planRevision + 1, dynamicMeals, { household, householdLikes: isHousehold ? app.householdSignals : {}, objective, pantryItems, usePantryFirst });
        app.saveWeeklyPlan(mealIds, summary, scope);
        setIsGenerating(false);
        generationTimer.current = undefined;
      })();
    }, 420);
  };

  const replacementPool = () => planSlots.map((meal) => meal ?? planMeals[0]).filter(Boolean) as Meal[];
  const replaceDay = (index: number, constraint?: PlannerAction["constraint"], summary?: string) => {
    if (replacingDay !== null || planMeals.length === 0) return false;
    setReplacingDay(index);
    const replacement = findReplacementMeal(replacementPool(), index, savedIds, preferences, planRevision + 1, dynamicMeals, { household, householdLikes: isHousehold ? app.householdSignals : {}, objective: optimizationObjective, pantryItems, usePantryFirst, constraint });
    if (replacement) app.replaceWeeklyMeal(index, replacement.id, summary ?? `${WEEKDAYS[index]} replaced with ${replacement.title}`, scope);
    window.setTimeout(() => setReplacingDay(null), 260);
    return Boolean(replacement);
  };

  const combineDays = (mainIndex: number, sideIndex: number, targetIndex = mainIndex) => {
    const mainMeal = planSlots[mainIndex];
    const sideMeal = planSlots[sideIndex];
    if (!mainMeal || !sideMeal) return "Both selected days need a meal before they can be combined.";
    const combined = createCombinedMeal(mainMeal, sideMeal, servings);
    const safety = mealSafetyForHousehold(combined, household);
    if (!safety.safe) return `Combination blocked because it conflicts with ${safety.conflicts.join(", ")}.`;
    app.addDynamicMeal(combined, scope);
    app.replaceWeeklyMeal(targetIndex, combined.id, `${WEEKDAYS[targetIndex]} is now ${combined.title}`, scope);
    return `${WEEKDAYS[targetIndex]} updated to ${combined.title}. Shopping and optimization metrics were recalculated.`;
  };

  const applyActions = (actions: PlannerAction[]) => {
    let result = "Plan updated. Safety, ingredient reuse, and the shopping list were recalculated.";
    for (const action of actions) {
      if (action.type === "swapDays") {
        const first = dayIndex(action.sourceDay); const second = dayIndex(action.destinationDay);
        if (first >= 0 && second >= 0) app.swapWeeklyDays(first, second, `${WEEKDAYS[first]} and ${WEEKDAYS[second]} swapped`, scope);
      } else if (action.type === "moveMeal") {
        const from = dayIndex(action.sourceDay); const to = dayIndex(action.destinationDay);
        if (from >= 0 && to >= 0) app.moveWeeklyMeal(from, to, `${WEEKDAYS[from]}'s meal moved to ${WEEKDAYS[to]}`, scope);
      } else if (action.type === "removeMeal") {
        const target = dayIndex(action.targetDay); if (target >= 0) app.removeWeeklyMeal(target, `${WEEKDAYS[target]} left open`, scope);
      } else if (action.type === "replaceMeal" || action.type === "changeMealConstraint") {
        const target = dayIndex(action.targetDay);
        if (target >= 0 && !replaceDay(target, action.constraint)) result = `No safe meal matched that request for ${WEEKDAYS[target]}. Nothing changed.`;
      } else if (action.type === "combineMealComponents") {
        const main = dayIndex(action.mainFromDay); const side = dayIndex(action.sideFromDay); const target = dayIndex(action.targetDay);
        if (main >= 0 && side >= 0) result = combineDays(main, side, target >= 0 ? target : main);
      } else if (action.type === "optimizeWeek" && action.objective) {
        app.setOptimizationObjective(action.objective, scope);
        generate(action.objective, `Week optimized for ${objectiveLabels[action.objective]}`);
      }
    }
    setAssistantStatus(result);
    setProposal(null);
    setInstruction("");
  };

  const askPlanner = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!instruction.trim() || isPlanning) return;
    setIsPlanning(true); setProposal(null); setAssistantStatus(null);
    try {
      const response = await fetch("/api/planner/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instruction, plan: planSlots.map((meal, index) => ({ day: WEEKDAYS[index], title: meal?.title ?? null, ingredients: meal?.ingredients.map((item) => item.name) ?? [] })), household }) });
      const data = await response.json() as { proposal?: PlannerProposal; message?: string };
      if (!response.ok || !data.proposal) throw new Error(data.message ?? "Planner unavailable");
      setProposal(data.proposal);
      if (data.proposal.clarification) setAssistantStatus(data.proposal.clarification);
    } catch {
      setAssistantStatus("The planner is taking a break. Your current week is safe and unchanged—please try again.");
    } finally { setIsPlanning(false); }
  };

  const startListening = () => {
    const browserWindow = window as typeof window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
    const Recognition = browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition;
    if (!Recognition) { setAssistantStatus("Voice input is not supported in this browser. You can type the same instruction below."); return; }
    const recognition = new Recognition();
    recognition.continuous = false; recognition.interimResults = false; recognition.lang = "en-GB";
    recognition.onresult = (event) => { const transcript = event.results[0]?.[0]?.transcript ?? ""; setInstruction(transcript); setAssistantStatus(`Heard: “${transcript}”`); };
    recognition.onerror = () => setAssistantStatus("I couldn't hear that clearly. Try again or type your request.");
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition; setIsListening(true); recognition.start();
  };

  const addPantry = async () => {
    const names = pantryInput.split(",").map((item) => item.trim()).filter(Boolean);
    if (!names.length) return;
    setIsSavingPantry(true); setPantryStatus(null);
    const saved = await app.addPantryItems(names.map((name) => ({ name, source: "manual", confirmed: true })), scope);
    if (saved) setPantryInput("");
    else setPantryStatus(`We couldn't update ${isHousehold ? "the shared" : "your"} pantry. Please try again.`);
    setIsSavingPantry(false);
  };

  const beginPantryEdit = (id: string) => {
    const item = pantryItems.find((candidate) => candidate.id === id);
    if (!item) return;
    setEditingPantryId(id);
    setPantryDraftName(item.name);
    setPantryDraftQuantity(item.quantity === null || item.quantity === undefined ? "" : String(item.quantity));
    setPantryDraftUnit(item.unit ?? "");
    setPantryStatus(null);
  };

  const savePantryEdit = async () => {
    if (!editingPantryId || !pantryDraftName.trim()) return;
    const quantity = pantryDraftQuantity.trim() === "" ? null : Number(pantryDraftQuantity);
    if (quantity !== null && (!Number.isFinite(quantity) || quantity < 0)) {
      setPantryStatus("Enter a valid pantry quantity.");
      return;
    }
    setIsSavingPantry(true); setPantryStatus(null);
    const saved = await app.updatePantryItem(editingPantryId, {
      name: pantryDraftName.trim(),
      quantity,
      unit: pantryDraftUnit.trim() || null,
    }, scope);
    if (saved) setEditingPantryId(null);
    else setPantryStatus("We couldn't save that pantry change. Check for a duplicate name and try again.");
    setIsSavingPantry(false);
  };

  const confirmPhotoItems = async () => {
    setIsSavingPantry(true); setPantryStatus(null);
    const saved = await app.addPantryItems(photoItems.map((name) => ({ name, source: "ai-detected", confirmed: true })), scope);
    if (saved) { setPhotoItems([]); setPhotoNote(null); }
    else setPantryStatus(`We couldn't add the confirmed items to ${isHousehold ? "the shared" : "your"} pantry.`);
    setIsSavingPantry(false);
  };

  const removePantryItem = async (id: string) => {
    setIsSavingPantry(true); setPantryStatus(null);
    const removed = await app.removePantryItem(id, scope);
    if (removed) {
      if (editingPantryId === id) setEditingPantryId(null);
    } else setPantryStatus(`We couldn't remove that ${isHousehold ? "shared " : ""}pantry item. Please try again.`);
    setIsSavingPantry(false);
  };

  const analyzePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) { setPhotoNote("Choose an image smaller than 4 MB."); return; }
    setIsAnalyzingPhoto(true); setPhotoNote(null); setPhotoItems([]);
    try {
      const imageDataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const response = await fetch("/api/pantry/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageDataUrl }) });
      const data = await response.json() as { result?: { items: { name: string }[]; note: string }; message?: string };
      if (!response.ok || !data.result) throw new Error(data.message ?? "Analysis failed");
      setPhotoItems(data.result.items.map((item) => item.name)); setPhotoNote(data.result.note);
    } catch { setPhotoNote("We couldn't analyze that photo. Add the ingredients manually instead."); }
    finally { setIsAnalyzingPhoto(false); event.target.value = ""; }
  };

  if (isHousehold && !app.account?.household) {
    return <section className="week-planner"><div className="plan-intro-card"><p className="eyebrow">Optional collaboration</p><h2>Create or join a household first.</h2><p className="plan-intro-copy">Your personal plan remains available in My Week. Household plans only begin after an accepted invitation.</p><Link className="generate-week-button" href="/household">Open Household</Link></div></section>;
  }

  if (planMeals.length === 0) {
    return (
      <section className="week-planner">
        <div className="household-summary-card"><div><Users size={19} /><span><strong>{isHousehold ? household.name : "My plan"}</strong>{isHousehold ? household.members.map((member) => member.name).join(" + ") : "Personal preferences and pantry"}</span></div><b><ShieldCheck size={14} /> {isHousehold ? `${household.members.length} profiles` : "Private"}</b></div>
        <div className="plan-intro-card">
          <div className="plan-intro-art" aria-hidden="true"><div className="plan-orbit plan-orbit-one" /><div className="plan-orbit plan-orbit-two" /><span className="plan-spark plan-spark-one"><Sparkles size={18} /></span><span className="plan-spark plan-spark-two"><Sparkles size={13} /></span><div className="plan-calendar-icon"><CalendarDays size={34} /><span>{household.settings.dinnersPerWeek}</span></div></div>
          <p className="eyebrow">Your smart menu</p><h2>A week designed to work together.</h2>
          <p className="plan-intro-copy">We&apos;ll start with {isHousehold ? "everyone's eligible likes, enforce every household restriction" : "your favourites and personal restrictions"}, and choose meals that share ingredients.</p>
          <div className="plan-source-row"><div><Heart size={17} fill="currentColor" /><span><strong>{safeSavedCount}</strong> safe favourite{safeSavedCount === 1 ? "" : "s"}</span></div><div><WandSparkles size={17} /><span><strong>{Math.max(0, household.settings.dinnersPerWeek - safeSavedCount)}</strong> smart picks</span></div></div>
          {safeMeals.length ? <button className="generate-week-button" type="button" onClick={() => generate()} disabled={isGenerating}>{isGenerating ? <><RefreshCw className="spin" size={20} /> Building your week…</> : <><Sparkles size={20} /> Generate {isHousehold ? "Shared" : "My"} Week</>}</button> : <div className="no-safe-meals"><strong>No safe matches available</strong><p>Your current restrictions exclude every starter meal.</p><Link href="/account">Adjust profile</Link></div>}
          <p className="plan-safety-note"><Check size={13} /> Allergies and dietary restrictions are always hard filters.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="week-planner week-planner-generated">
      <div className="household-summary-card"><div><Users size={19} /><span><strong>{isHousehold ? household.name : "My plan"}</strong>{isHousehold ? household.members.map((member) => member.name).join(" + ") : "Personal preferences and pantry"}</span></div><b><ShieldCheck size={14} /> Safety checked</b></div>
      {incompatiblePlanCount ? <div className="account-message" role="alert"><ShieldCheck size={15} /> {incompatiblePlanCount} existing meal{incompatiblePlanCount === 1 ? " may" : "s may"} no longer match {isHousehold ? "a household member's" : "your"} updated restrictions. Unsafe slots were hidden.</div> : null}

      <section className="planner-assistant-card">
        <header><div className="assistant-mark"><Sparkles size={19} /></div><div><p className="eyebrow">MealSwipe planner</p><h2>Change the week with your voice</h2></div><button type="button" className={`mic-button${isListening ? " is-listening" : ""}`} onClick={isListening ? () => recognitionRef.current?.stop() : startListening} aria-label={isListening ? "Stop listening" : "Speak to the planner"}>{isListening ? <MicOff size={20} /> : <Mic size={20} />}</button></header>
        <form onSubmit={askPlanner}><input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Try “salmon from Tuesday, potatoes from Thursday”" aria-label="Planner instruction" /><button type="submit" disabled={!instruction.trim() || isPlanning} aria-label="Send instruction">{isPlanning ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}</button></form>
        {assistantStatus ? <p className="assistant-status">{assistantStatus}</p> : null}
        {proposal && proposal.actions.length > 0 ? <div className="planner-confirmation"><span><ShieldCheck size={18} /></span><div><strong>{proposal.summary}</strong><p>We&apos;ll re-check every household rule before applying it.</p><div><button type="button" onClick={() => applyActions(proposal.actions)}>Confirm</button><button type="button" onClick={() => setProposal(null)}>Cancel</button></div></div></div> : null}
      </section>

      <section className="optimization-control">
        <div><p className="eyebrow">Optimize for</p><h2>{objectiveLabels[optimizationObjective]}</h2></div>
        <label><span className="sr-only">Optimization objective</span><select value={optimizationObjective} onChange={(event) => { const value = event.target.value as OptimizationObjective; app.setOptimizationObjective(value, scope); generate(value, `Week optimized for ${objectiveLabels[value]}`); }}>{Object.entries(objectiveLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown size={15} /></label>
        {optimizationObjective === "lowest-cost" ? <p>Cost uses ingredient and complexity estimates—not live grocery prices.</p> : null}
      </section>

      <div className="plan-payoff">
        <div className="plan-payoff-top"><div><p className="eyebrow">This week&apos;s optimization</p><h2>The week works as one.</h2></div><span className="payoff-check"><Check size={19} /></span></div>
        <div className="optimization-metrics">
          <div><strong>{reuseStats.totalIngredientOccurrences}</strong><span>total uses</span></div>
          <div><strong>{reuseStats.uniqueIngredientCount}</strong><span>unique items</span></div>
          <div><strong>{reuseStats.sharedIngredientCount}</strong><span>reused</span></div>
          <div><strong>{reuseStats.mealsSharingIngredients}</strong><span>meals sharing</span></div>
        </div>
        <div className="reuse-number"><strong>{reuseStats.reusedOccurrences}</strong><span>duplicate purchases avoided</span></div>
        {reuseStats.sharedIngredients.length ? <div className="reuse-pills">{reuseStats.sharedIngredients.slice(0, 5).map((ingredient) => <span key={ingredient.name}>{titleCase(ingredient.name)} <b>×{ingredient.count}</b></span>)}</div> : null}
        <div className="payoff-footer"><span>Estimated waste reduction: {reuseStats.estimatedWasteReduction.toLowerCase()}</span><button type="button" onClick={() => generate()} disabled={isGenerating}><RefreshCw className={isGenerating ? "spin" : ""} size={15} /> Regenerate</button></div>
      </div>

      {lastPlanChange ? <div className="plan-change-toast"><Check size={15} /><span>{lastPlanChange}</span></div> : null}

      <div className="week-list-heading"><div><p className="eyebrow">Monday to Sunday</p><h2>Your dinner plan</h2></div><span>{safeSavedCount} liked</span></div>
      <div className="day-card-list">
        {planSlots.map((meal, index) => (
          <div className="day-slot" key={WEEKDAYS[index]}>
            {meal ? (
              <article className={`day-meal-card${replacingDay === index ? " is-replacing" : ""}`}>
                <div className="day-meal-image"><Image src={meal.image} alt={meal.title} fill loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 760px) 116px, 132px" /><span>{index + 1}</span></div>
                <div className="day-meal-content">
              <div className="day-label-row"><p>{WEEKDAYS[index]}</p>{isHousehold && (app.householdSignals[meal.id]?.length ?? 0) >= 2 ? <span><Heart size={10} fill="currentColor" /> Liked by multiple members</span> : isHousehold && app.householdSignals[meal.id]?.length ? <span><Heart size={10} fill="currentColor" /> @{app.householdSignals[meal.id][0]} liked this</span> : savedSet.has(meal.id) ? <span><Heart size={10} fill="currentColor" /> Liked</span> : <span className="smart-pick"><Sparkles size={10} /> Smart pick</span>}</div>
                  <h3>{meal.title}</h3><p className="day-time"><Clock3 size={13} /> {meal.timeMinutes} min · {meal.proteinGrams}g protein</p>
                  <div className="day-ingredients">{meal.ingredients.slice(0, 3).map((ingredient) => <span key={ingredient.name}>{ingredient.name}</span>)}</div>
                  <div className="day-card-bottom"><div className="dietary-tags">{meal.dietary.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}</div><div className="day-action-buttons"><button type="button" onClick={() => replaceDay(index)}><Repeat2 size={14} /> Replace</button><button type="button" onClick={() => { setEditorDay(editorDay === index ? null : index); setEditorMode(null); }}><ChevronDown size={14} /> Edit</button></div></div>
                </div>
              </article>
            ) : <article className="open-day-card"><div><span>{index + 1}</span><div><p>{WEEKDAYS[index]}</p><h3>Open dinner</h3></div></div><button type="button" onClick={() => replaceDay(index)}><Plus size={16} /> Add meal</button></article>}
            {editorDay === index && meal ? (
              <div className="day-edit-panel">
                <div className="day-edit-actions"><button type="button" className={editorMode === "swap" ? "selected" : ""} onClick={() => setEditorMode("swap")}><ArrowRightLeft size={15} /> Swap</button><button type="button" className={editorMode === "move" ? "selected" : ""} onClick={() => setEditorMode("move")}><MoveRight size={15} /> Move</button><button type="button" className={editorMode === "combine" ? "selected" : ""} onClick={() => setEditorMode("combine")}><WandSparkles size={15} /> Combine</button><button type="button" onClick={() => { setProposal({ summary: `Remove ${WEEKDAYS[index]}'s meal?`, needsConfirmation: true, actions: [{ type: "removeMeal", targetDay: WEEKDAYS[index] }] }); setEditorDay(null); }}><Trash2 size={15} /> Remove</button></div>
                {editorMode ? <div className="day-targets"><span>{editorMode === "combine" ? "Use the side from" : editorMode === "swap" ? "Swap with" : "Move to"}</span>{WEEKDAYS.map((day, target) => target !== index && planSlots[target] ? <button type="button" key={day} onClick={() => { const action: PlannerAction = editorMode === "combine" ? { type: "combineMealComponents", targetDay: WEEKDAYS[index], mainFromDay: WEEKDAYS[index], sideFromDay: day } : editorMode === "swap" ? { type: "swapDays", sourceDay: WEEKDAYS[index], destinationDay: day } : { type: "moveMeal", sourceDay: WEEKDAYS[index], destinationDay: day }; setProposal({ summary: editorMode === "combine" ? `Change ${WEEKDAYS[index]} to ${meal.title} with ${planSlots[target]?.title}'s side?` : `${titleCase(editorMode)} ${WEEKDAYS[index]} ${editorMode === "swap" ? "with" : "to"} ${day}?`, needsConfirmation: true, actions: [action] }); setEditorDay(null); setEditorMode(null); }}>{day.slice(0, 3)}</button> : null)}</div> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <section className="pantry-card">
        <header><div className="pantry-icon"><PackageCheck size={22} /></div><div><p className="eyebrow">{isHousehold ? "What do we already have?" : "What do I already have?"}</p><h2>{isHousehold ? "Shared pantry" : "My pantry & fridge"}</h2><p className="pantry-shared-label"><Users size={11} /> {isHousehold ? "Shared with your household" : "Private to your account"}</p></div><label className="pantry-toggle"><input type="checkbox" checked={usePantryFirst} onChange={(event) => app.setUsePantryFirst(event.target.checked, scope)} /><span>Use these first</span></label></header>
        <div className="pantry-entry"><input aria-label="Add pantry items" value={pantryInput} onChange={(event) => setPantryInput(event.target.value)} placeholder="eggs, feta, spinach…" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void addPantry(); } }} /><button type="button" onClick={() => void addPantry()} disabled={isSavingPantry}><Plus size={17} /> Add</button><label className="photo-upload"><input type="file" accept="image/*" onChange={analyzePhoto} disabled={isAnalyzingPhoto || isSavingPantry} /><ImagePlus size={17} /><span>{isAnalyzingPhoto ? "Looking…" : "Photo"}</span></label></div>
        {pantryItems.length ? <div className="pantry-chips">{pantryItems.map((item) => <span key={item.id}><span>{item.name}{item.quantity !== null && item.quantity !== undefined ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : ""}</span><button type="button" onClick={() => beginPantryEdit(item.id)} aria-label={`Edit ${item.name}`} disabled={isSavingPantry}><Pencil size={11} /></button><button type="button" onClick={() => void removePantryItem(item.id)} aria-label={`Remove ${item.name}`} disabled={isSavingPantry}><X size={12} /></button></span>)}</div> : <p className="pantry-empty">Add ingredients to prioritize them and keep them off the shopping list.</p>}
        {editingPantryId ? <div className="pantry-edit"><input aria-label="Pantry item name" value={pantryDraftName} onChange={(event) => setPantryDraftName(event.target.value)} /><input aria-label="Pantry item quantity" type="number" min="0" step="any" placeholder="Qty" value={pantryDraftQuantity} onChange={(event) => setPantryDraftQuantity(event.target.value)} /><input aria-label="Pantry item unit" placeholder="Unit" value={pantryDraftUnit} onChange={(event) => setPantryDraftUnit(event.target.value)} /><button type="button" onClick={() => void savePantryEdit()} disabled={isSavingPantry}>Save</button><button type="button" onClick={() => setEditingPantryId(null)}>Cancel</button></div> : null}
        {pantryStatus ? <p className="pantry-status" role="status">{pantryStatus}</p> : null}
        {photoItems.length ? <div className="photo-findings"><strong>We found—please confirm:</strong><div>{photoItems.map((item) => <span key={item}>{item}</span>)}</div>{photoNote ? <p>{photoNote}</p> : null}<footer><button type="button" onClick={() => void confirmPhotoItems()} disabled={isSavingPantry}>Confirm items</button><button type="button" onClick={() => { setPhotoItems([]); setPhotoNote(null); }}>Cancel</button></footer></div> : photoNote ? <p className="photo-note">{photoNote}</p> : null}
      </section>

      <section className="shopping-list-card">
        <header className="shopping-header"><div className="shopping-icon"><ShoppingBasket size={23} /></div><div><p className="eyebrow">Live list for {planMeals.length} dinners</p><h2>Shopping list</h2></div><span>{checkedItems.size}/{neededShoppingItems.length}</span></header>
        <div className="shopping-progress"><span style={{ width: `${neededShoppingItems.length ? (checkedItems.size / neededShoppingItems.length) * 100 : 0}%` }} /></div>
        <p className="shopping-summary">Matching units are combined. {isHousehold ? "Shared household" : "Personal"} pantry items stay visible but are removed from what you need to buy.</p>
        <div className="shopping-groups">{groupedShopping.map(({ category, items }) => <section className="shopping-group" key={category}><header><span>{categoryIcons[category]}</span><h3>{category}</h3><small>{items.length}</small></header><div>{items.map((item) => { const checked = checkedItems.has(item.name); const amount = formatShoppingAmount(item); return <button className={`shopping-item${checked ? " is-checked" : ""}${item.mealCount > 1 ? " is-shared" : ""}${item.inPantry ? " is-pantry" : ""}`} key={item.name} type="button" aria-pressed={checked} onClick={() => !item.inPantry && app.toggleShoppingItem(item.name, scope)}><span className="shopping-check">{item.inPantry ? <PackageCheck size={13} /> : checked ? <Check size={13} /> : null}</span><span className="shopping-item-copy"><strong>{titleCase(item.name)}</strong><small>{item.inPantry ? "Already in your pantry" : `${amount ? `${amount} · ` : ""}Used in ${item.usedIn.join(" + ")}`}</small></span>{item.inPantry ? <b>PANTRY</b> : item.mealCount > 1 ? <b>REUSE</b> : null}</button>; })}</div></section>)}</div>
      </section>
    </section>
  );
}
