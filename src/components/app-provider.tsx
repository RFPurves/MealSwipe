"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import type {
  Household,
  Meal,
  OptimizationObjective,
  PantryItem,
  Preferences,
  YouTubeMealCandidate,
} from "@/types";
import { defaultHousehold, defaultPreferences } from "@/types";
import type { AccountBootstrap } from "@/types/account";
import { normalizePantryName } from "@/lib/pantry";

const STORAGE_KEY = "meal-swipe-state-v4";
const LEGACY_STORAGE_KEYS = ["meal-swipe-state-v3", "meal-swipe-state-v2", "meal-swipe-state-v1"];

interface StoredState {
  hasOnboarded: boolean;
  preferences: Preferences;
  household: Household;
  savedIds: string[];
  skippedIds: string[];
  weeklyPlanIds: (string | null)[];
  planRevision: number;
  dynamicMeals: Meal[];
  checkedShoppingItems: string[];
  optimizationObjective: OptimizationObjective;
  pantryItems: PantryItem[];
  usePantryFirst: boolean;
  demoMode: boolean;
  lastPlanChange?: string;
  householdWeeklyPlanIds: (string | null)[];
  householdPlanRevision: number;
  householdDynamicMeals: Meal[];
  householdCheckedShoppingItems: string[];
  householdOptimizationObjective: OptimizationObjective;
  householdPantryItems: PantryItem[];
  householdUsePantryFirst: boolean;
  householdLastPlanChange?: string;
}

export type PlanningScope = "personal" | "household";

interface AppContextValue extends StoredState {
  hydrated: boolean;
  account: AccountBootstrap | null;
  accountLoading: boolean;
  accountError: boolean;
  householdSignals: Record<string, string[]>;
  refreshAccount: () => Promise<void>;
  completeOnboarding: (preferences: Preferences, profile: { name: string; username: string; image: string | null }) => Promise<{ ok: true } | { ok: false; message: string }>;
  updateHousehold: (household: Household) => void;
  likeMeal: (id: string) => void;
  skipMeal: (id: string) => void;
  removeSavedMeal: (id: string) => void;
  saveVideoMeal: (candidate: YouTubeMealCandidate) => string;
  updateVideoRecipe: (id: string, meal: Meal) => void;
  markRecipeFailed: (id: string) => void;
  saveWeeklyPlan: (mealIds: (string | null)[], summary?: string, scope?: PlanningScope) => void;
  replaceWeeklyMeal: (dayIndex: number, mealId: string, summary?: string, scope?: PlanningScope) => void;
  swapWeeklyDays: (firstIndex: number, secondIndex: number, summary?: string, scope?: PlanningScope) => void;
  moveWeeklyMeal: (fromIndex: number, toIndex: number, summary?: string, scope?: PlanningScope) => void;
  removeWeeklyMeal: (dayIndex: number, summary?: string, scope?: PlanningScope) => void;
  addDynamicMeal: (meal: Meal, scope?: PlanningScope) => void;
  setOptimizationObjective: (objective: OptimizationObjective, scope?: PlanningScope) => void;
  addPantryItems: (items: Omit<PantryItem, "id">[], scope?: PlanningScope) => Promise<boolean>;
  updatePantryItem: (id: string, changes: { name: string; quantity: number | null; unit: string | null }, scope?: PlanningScope) => Promise<boolean>;
  removePantryItem: (id: string, scope?: PlanningScope) => Promise<boolean>;
  setUsePantryFirst: (value: boolean, scope?: PlanningScope) => void;
  toggleShoppingItem: (name: string, scope?: PlanningScope) => void;
  resetDiscovery: () => void;
  loadDemoState: () => void;
  resetApp: () => void;
}

const initialState: StoredState = {
  hasOnboarded: false,
  preferences: defaultPreferences,
  household: defaultHousehold,
  savedIds: [],
  skippedIds: [],
  weeklyPlanIds: [],
  planRevision: 0,
  dynamicMeals: [],
  checkedShoppingItems: [],
  optimizationObjective: "balanced",
  pantryItems: [],
  usePantryFirst: false,
  demoMode: false,
  householdWeeklyPlanIds: [],
  householdPlanRevision: 0,
  householdDynamicMeals: [],
  householdCheckedShoppingItems: [],
  householdOptimizationObjective: "balanced",
  householdPantryItems: [],
  householdUsePantryFirst: false,
};

const demoMeals: Meal[] = [
  {
    id: "youtube:demo-salmon",
    title: "Maple Miso Salmon",
    description: "A cached demo recipe inspired by a short-form cooking video, with a glossy miso glaze.",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1200&q=90",
    category: "Seafood",
    categories: ["Seafood", "Asian", "High protein"],
    timeMinutes: 25,
    calories: 540,
    proteinGrams: 42,
    servings: 4,
    dietary: ["Pescatarian", "High protein"],
    allergens: ["Soy"],
    ingredients: [
      { name: "salmon fillet", amount: 640, unit: "g" },
      { name: "white miso", amount: 45, unit: "ml" },
      { name: "maple syrup", amount: 30, unit: "ml" },
      { name: "broccoli", amount: 400, unit: "g" },
      { name: "lemon", amount: 1, unit: "pc" },
    ],
    instructions: ["Whisk the miso glaze.", "Roast the salmon and broccoli until just cooked.", "Finish with lemon."],
    sourceType: "youtube",
    channelTitle: "The Weeknight Kitchen",
    recipeOrigin: "ai-estimated",
    recipeStatus: "ready",
    safetyStatus: "safe",
    safetyNotes: ["Cached demo recipe. Quantities are AI-estimated and should be reviewed."],
    source: { platform: "youtube", creator: "The Weeknight Kitchen", originalTitle: "Maple miso salmon dinner", generationMethod: "ai-estimated" },
  },
  {
    id: "youtube:demo-potatoes",
    title: "Crispy Herb Potatoes & Greens",
    description: "Golden roasted potatoes with lemony greens—the side built for Thursday's dinner.",
    image: "https://images.unsplash.com/photo-1518013431117-eb1465fa5752?auto=format&fit=crop&w=1200&q=90",
    category: "Vegetarian",
    categories: ["Vegetarian", "Mediterranean"],
    timeMinutes: 35,
    calories: 430,
    proteinGrams: 14,
    servings: 4,
    dietary: ["Vegetarian", "Vegan"],
    allergens: [],
    ingredients: [
      { name: "baby potatoes", amount: 800, unit: "g" },
      { name: "spinach", amount: 180, unit: "g" },
      { name: "lemon", amount: 1, unit: "pc" },
      { name: "garlic", amount: 3, unit: "cloves" },
      { name: "olive oil", amount: 45, unit: "ml" },
    ],
    instructions: ["Roast the potatoes until crisp.", "Wilt the greens with garlic.", "Finish with lemon."],
    sourceType: "youtube",
    channelTitle: "Everyday Plates",
    recipeOrigin: "ai-estimated",
    recipeStatus: "ready",
    safetyStatus: "safe",
    safetyNotes: ["Cached demo recipe. Ingredients are AI-estimated from source metadata."],
    source: { platform: "youtube", creator: "Everyday Plates", originalTitle: "The crispiest roast potatoes", generationMethod: "ai-estimated" },
  },
  {
    id: "youtube:demo-tomatoes",
    title: "Creamy Tomato Butter Beans",
    description: "Silky tomato beans with spinach and basil for an easy pantry-first dinner.",
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=90",
    category: "Mediterranean",
    categories: ["Mediterranean", "Vegetarian", "Quick meals"],
    timeMinutes: 20,
    calories: 470,
    proteinGrams: 23,
    servings: 4,
    dietary: ["Vegetarian"],
    allergens: ["Dairy"],
    ingredients: [
      { name: "butter beans", amount: 500, unit: "g" },
      { name: "crushed tomatoes", amount: 400, unit: "g" },
      { name: "spinach", amount: 150, unit: "g" },
      { name: "cream", amount: 120, unit: "ml" },
      { name: "basil", amount: 1, unit: "bunch" },
    ],
    sourceType: "youtube",
    channelTitle: "Dinner in Twenty",
    recipeOrigin: "ai-estimated",
    recipeStatus: "ready",
    safetyStatus: "safe",
    safetyNotes: ["Cached demo recipe. Ingredients are AI-estimated from source metadata."],
    source: { platform: "youtube", creator: "Dinner in Twenty", originalTitle: "20 minute butter beans", generationMethod: "ai-estimated" },
  },
];

function vcDemoState(): StoredState {
  return {
    hasOnboarded: true,
    preferences: {
      dietary: "Pescatarian",
      allergies: ["Nuts"],
      dislikedIngredients: ["Mushrooms", "Coriander"],
      categories: ["Seafood", "Mediterranean", "Quick meals", "High protein"],
      nutritionPreference: "Balanced",
      maximumCookingTime: 40,
      personalDinnersPerWeek: 7,
      strictDislikes: true,
    },
    household: {
      name: "The Purves household",
      members: [
        { id: "rab", name: "Rab", dietary: "Everything", allergies: [], dislikedIngredients: ["Mushrooms"], nutritionPreference: "High protein" },
        { id: "sonia", name: "Sonia", dietary: "Pescatarian", allergies: ["Nuts"], dislikedIngredients: ["Coriander"], nutritionPreference: "Balanced" },
      ],
      settings: { adults: 2, children: 0, dinnersPerWeek: 7, maximumCookingTime: 40, weeklyBudget: 95 },
    },
    savedIds: demoMeals.map((meal) => meal.id),
    skippedIds: [],
    weeklyPlanIds: [
      "miso-salmon-bowl", "youtube:demo-salmon", "coconut-chickpea-curry",
      "youtube:demo-potatoes", "baked-feta-salmon", "green-goddess-gnocchi", "shakshuka-feta",
    ],
    planRevision: 1,
    dynamicMeals: demoMeals,
    checkedShoppingItems: [],
    optimizationObjective: "least-waste",
    pantryItems: ["eggs", "feta", "spinach", "tomatoes", "cucumber", "rice"].map((name, index) => ({ id: `demo-pantry-${index}`, name, source: "demo", confirmed: true })),
    usePantryFirst: true,
    demoMode: true,
    lastPlanChange: "VC demo week loaded",
    householdWeeklyPlanIds: [],
    householdPlanRevision: 0,
    householdDynamicMeals: [],
    householdCheckedShoppingItems: [],
    householdOptimizationObjective: "balanced",
    householdPantryItems: [],
    householdUsePantryFirst: false,
  };
}

function normalizeStored(parsed: Partial<StoredState>): StoredState {
  return {
    ...initialState,
    ...parsed,
    household: parsed.household ?? defaultHousehold,
    weeklyPlanIds: (parsed.weeklyPlanIds ?? []).map((id) => id || null),
    optimizationObjective: parsed.optimizationObjective ?? "balanced",
    pantryItems: parsed.pantryItems ?? [],
    householdWeeklyPlanIds: (parsed.householdWeeklyPlanIds ?? []).map((id) => id || null),
    householdPantryItems: parsed.householdPantryItems ?? [],
  };
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [state, setState] = useState<StoredState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [account, setAccount] = useState<AccountBootstrap | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountError, setAccountError] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshAccount = useCallback(async () => {
    if (status !== "authenticated") return;
    setAccountLoading(true);
    setAccountError(false);
    try {
      const response = await fetch("/api/account/bootstrap", { cache: "no-store" });
      if (!response.ok) throw new Error("Account unavailable");
      const data = await response.json() as { account: AccountBootstrap };
      setAccount(data.account);
      setState((current) => {
        if (current.demoMode) return current;
        const dynamicById = new Map(current.dynamicMeals.map((meal) => [meal.id, meal]));
        data.account.dynamicMeals.forEach((meal) => dynamicById.set(meal.id, meal));
        const hasDemoArtifacts = current.dynamicMeals.some((meal) => meal.id.startsWith("youtube:demo-"))
          || current.lastPlanChange === "VC demo week loaded";
        const pantryChanged = JSON.stringify(current.pantryItems.map((item) => [item.id, item.name, item.quantity, item.unit]))
          !== JSON.stringify(data.account.pantryItems.map((item) => [item.id, item.name, item.quantity, item.unit]));
        return {
          ...current,
          preferences: data.account.preferences,
          household: data.account.household ?? current.household,
          hasOnboarded: data.account.user.profileCompleted === true,
          savedIds: data.account.savedIds,
          skippedIds: data.account.skippedIds,
          dynamicMeals: hasDemoArtifacts ? data.account.dynamicMeals : [...dynamicById.values()],
          weeklyPlanIds: data.account.latestPlanIds,
          pantryItems: data.account.pantryItems,
          householdWeeklyPlanIds: data.account.householdLatestPlanIds,
          householdDynamicMeals: data.account.householdDynamicMeals,
          householdPantryItems: data.account.householdPantryItems,
          householdCheckedShoppingItems: JSON.stringify(current.householdPantryItems.map((item) => [item.id, item.name, item.quantity, item.unit])) !== JSON.stringify(data.account.householdPantryItems.map((item) => [item.id, item.name, item.quantity, item.unit])) ? [] : current.householdCheckedShoppingItems,
          checkedShoppingItems: pantryChanged ? [] : current.checkedShoppingItems,
          ...(hasDemoArtifacts ? { usePantryFirst: false, lastPlanChange: undefined } : {}),
        };
      });
    } catch {
      setAccount(null);
      setAccountError(true);
    } finally {
      setAccountLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      try {
        if (new URLSearchParams(window.location.search).get("demo") === "vc") {
          setState(vcDemoState());
        } else {
          const stored = window.localStorage.getItem(STORAGE_KEY)
            ?? LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
          if (stored) setState({ ...normalizeStored(JSON.parse(stored) as Partial<StoredState>), demoMode: false });
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(hydrateTimer);
  }, []);

  useEffect(() => {
    if (hydrated) {
      const persisted = status === "authenticated" && !state.demoMode ? { ...state, pantryItems: [], householdPantryItems: [] } : state;
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    }
  }, [hydrated, state, status]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (hydrated && status === "authenticated" && !state.demoMode) {
        setState((current) => current.pantryItems.length || current.householdPantryItems.length ? { ...current, pantryItems: [], householdPantryItems: [], checkedShoppingItems: [], householdCheckedShoppingItems: [] } : current);
        void refreshAccount();
      }
      if (status === "unauthenticated") setAccount(null);
    });
    return () => { active = false; };
  }, [hydrated, refreshAccount, state.demoMode, status]);

  const sendAccountMutation = useCallback(async (url: string, init: RequestInit) => {
    if (status !== "authenticated" || state.demoMode) return;
    try {
      await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    } catch {
      // Local state remains usable while connectivity recovers; the account screen exposes server errors for explicit actions.
    }
  }, [state.demoMode, status]);

  const completeOnboarding = useCallback(async (preferences: Preferences, profile: { name: string; username: string; image: string | null }) => {
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, preferences, completeProfile: true }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) return { ok: false as const, message: data.message ?? "Your profile could not be saved." };
      setState((current) => ({ ...current, hasOnboarded: true, preferences, weeklyPlanIds: [], checkedShoppingItems: [], demoMode: false }));
      await refreshAccount();
      return { ok: true as const };
    } catch {
      return { ok: false as const, message: "Your profile could not be saved. Check your connection and try again." };
    }
  }, [refreshAccount]);

  const updateHousehold = useCallback((household: Household) => setState((current) => ({ ...current, household, weeklyPlanIds: [], checkedShoppingItems: [] })), []);
  const likeMeal = useCallback((id: string) => {
    setState((current) => ({ ...current, savedIds: current.savedIds.includes(id) ? current.savedIds : [...current.savedIds, id], skippedIds: current.skippedIds.filter((mealId) => mealId !== id) }));
    void sendAccountMutation("/api/swipes", { method: "POST", body: JSON.stringify({ recipeIdentifier: id, action: "LIKED" }) });
  }, [sendAccountMutation]);
  const skipMeal = useCallback((id: string) => {
    setState((current) => ({ ...current, skippedIds: current.skippedIds.includes(id) ? current.skippedIds : [...current.skippedIds, id] }));
    void sendAccountMutation("/api/swipes", { method: "POST", body: JSON.stringify({ recipeIdentifier: id, action: "SKIPPED" }) });
  }, [sendAccountMutation]);
  const removeSavedMeal = useCallback((id: string) => {
    setState((current) => ({ ...current, savedIds: current.savedIds.filter((mealId) => mealId !== id) }));
    void sendAccountMutation(`/api/saved-recipes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  }, [sendAccountMutation]);

  const saveVideoMeal = useCallback((candidate: YouTubeMealCandidate) => {
    const id = `youtube:${candidate.videoId}`;
    setState((current) => {
      const existing = current.dynamicMeals.find((meal) => meal.id === id);
      const placeholder: Meal = existing ?? {
        id,
        title: candidate.title,
        description: candidate.description || `A cooking video from ${candidate.channelTitle}.`,
        image: candidate.thumbnail,
        category: candidate.category,
        categories: [candidate.category],
        timeMinutes: Math.max(5, Math.ceil(candidate.durationSeconds / 60)),
        calories: 0,
        proteinGrams: 0,
        servings: Math.max(1, current.household.settings.adults + Math.ceil(current.household.settings.children / 2)),
        dietary: [],
        allergens: [],
        ingredients: [],
        sourceType: "youtube",
        youtubeVideoId: candidate.videoId,
        youtubeUrl: candidate.sourceUrl,
        channelTitle: candidate.channelTitle,
        sourceDescription: candidate.description,
        source: { platform: "youtube", contentId: candidate.videoId, url: candidate.sourceUrl, creator: candidate.channelTitle, originalTitle: candidate.title, generationMethod: "fallback-estimated" },
        recipeStatus: "creating",
        recipeOrigin: "fallback-estimated",
        safetyStatus: "review-needed",
        safetyNotes: ["Recipe details are still being created."],
      };
      return { ...current, savedIds: current.savedIds.includes(id) ? current.savedIds : [...current.savedIds, id], skippedIds: current.skippedIds.filter((mealId) => mealId !== id), dynamicMeals: existing ? current.dynamicMeals : [...current.dynamicMeals, placeholder] };
    });
    return id;
  }, []);

  const updateVideoRecipe = useCallback((id: string, meal: Meal) => {
    const savedMeal = { ...meal, id };
    setState((current) => ({ ...current, dynamicMeals: current.dynamicMeals.map((existing) => existing.id === id ? savedMeal : existing) }));
    void sendAccountMutation("/api/saved-recipes", { method: "POST", body: JSON.stringify({ meal: savedMeal, visibility: "PRIVATE" }) });
  }, [sendAccountMutation]);
  const markRecipeFailed = useCallback((id: string) => setState((current) => ({ ...current, dynamicMeals: current.dynamicMeals.map((meal) => meal.id === id ? { ...meal, recipeStatus: "failed", safetyStatus: "review-needed", safetyNotes: ["We could not verify this recipe. Review the source before cooking."] } : meal) })), []);

  const persistWeeklyPlan = useCallback((planIds: (string | null)[], summary: string, scope: PlanningScope) => {
    const selectedIds = new Set(planIds.filter((id): id is string => Boolean(id)));
    const dynamicMeals = (scope === "household" ? stateRef.current.householdDynamicMeals : stateRef.current.dynamicMeals).filter((meal) => selectedIds.has(meal.id) && meal.recipeOrigin === "combined");
    const objective = scope === "household" ? stateRef.current.householdOptimizationObjective : stateRef.current.optimizationObjective;
    void sendAccountMutation(scope === "household" ? "/api/households/plan" : "/api/account/plan", { method: "PATCH", body: JSON.stringify({ planIds, summary, objective, dynamicMeals }) });
  }, [sendAccountMutation]);
  const saveWeeklyPlan = useCallback((mealIds: (string | null)[], summary = "Weekly plan updated", scope: PlanningScope = "personal") => {
    setState((current) => scope === "household" ? { ...current, householdWeeklyPlanIds: mealIds, householdPlanRevision: current.householdPlanRevision + 1, householdCheckedShoppingItems: [], householdLastPlanChange: summary } : { ...current, weeklyPlanIds: mealIds, planRevision: current.planRevision + 1, checkedShoppingItems: [], lastPlanChange: summary });
    persistWeeklyPlan(mealIds, summary, scope);
  }, [persistWeeklyPlan]);
  const replaceWeeklyMeal = useCallback((dayIndex: number, mealId: string, summary = "Meal replaced", scope: PlanningScope = "personal") => {
    const currentPlan = scope === "household" ? stateRef.current.householdWeeklyPlanIds : stateRef.current.weeklyPlanIds;
    const next = Array.from({ length: 7 }, (_, index) => index === dayIndex ? mealId : currentPlan[index] ?? null);
    stateRef.current = scope === "household" ? { ...stateRef.current, householdWeeklyPlanIds: next } : { ...stateRef.current, weeklyPlanIds: next };
    setState((current) => scope === "household" ? { ...current, householdWeeklyPlanIds: next, householdPlanRevision: current.householdPlanRevision + 1, householdCheckedShoppingItems: [], householdLastPlanChange: summary } : { ...current, weeklyPlanIds: next, planRevision: current.planRevision + 1, checkedShoppingItems: [], lastPlanChange: summary });
    persistWeeklyPlan(next, summary, scope);
  }, [persistWeeklyPlan]);
  const swapWeeklyDays = useCallback((firstIndex: number, secondIndex: number, summary = "Days swapped", scope: PlanningScope = "personal") => {
    const currentPlan = scope === "household" ? stateRef.current.householdWeeklyPlanIds : stateRef.current.weeklyPlanIds;
    const next = Array.from({ length: 7 }, (_, index) => currentPlan[index] ?? null);
    [next[firstIndex], next[secondIndex]] = [next[secondIndex], next[firstIndex]];
    stateRef.current = scope === "household" ? { ...stateRef.current, householdWeeklyPlanIds: next } : { ...stateRef.current, weeklyPlanIds: next };
    setState((current) => scope === "household" ? { ...current, householdWeeklyPlanIds: next, householdPlanRevision: current.householdPlanRevision + 1, householdCheckedShoppingItems: [], householdLastPlanChange: summary } : { ...current, weeklyPlanIds: next, planRevision: current.planRevision + 1, checkedShoppingItems: [], lastPlanChange: summary });
    persistWeeklyPlan(next, summary, scope);
  }, [persistWeeklyPlan]);
  const moveWeeklyMeal = useCallback((fromIndex: number, toIndex: number, summary = "Meal moved", scope: PlanningScope = "personal") => {
    const currentPlan = scope === "household" ? stateRef.current.householdWeeklyPlanIds : stateRef.current.weeklyPlanIds;
    const next = Array.from({ length: 7 }, (_, index) => currentPlan[index] ?? null);
    const moved = next[fromIndex];
    next[fromIndex] = next[toIndex];
    next[toIndex] = moved;
    stateRef.current = scope === "household" ? { ...stateRef.current, householdWeeklyPlanIds: next } : { ...stateRef.current, weeklyPlanIds: next };
    setState((current) => scope === "household" ? { ...current, householdWeeklyPlanIds: next, householdPlanRevision: current.householdPlanRevision + 1, householdCheckedShoppingItems: [], householdLastPlanChange: summary } : { ...current, weeklyPlanIds: next, planRevision: current.planRevision + 1, checkedShoppingItems: [], lastPlanChange: summary });
    persistWeeklyPlan(next, summary, scope);
  }, [persistWeeklyPlan]);
  const removeWeeklyMeal = useCallback((dayIndex: number, summary = "Meal removed", scope: PlanningScope = "personal") => {
    const currentPlan = scope === "household" ? stateRef.current.householdWeeklyPlanIds : stateRef.current.weeklyPlanIds;
    const next = Array.from({ length: 7 }, (_, index) => index === dayIndex ? null : currentPlan[index] ?? null);
    stateRef.current = scope === "household" ? { ...stateRef.current, householdWeeklyPlanIds: next } : { ...stateRef.current, weeklyPlanIds: next };
    setState((current) => scope === "household" ? { ...current, householdWeeklyPlanIds: next, householdPlanRevision: current.householdPlanRevision + 1, householdCheckedShoppingItems: [], householdLastPlanChange: summary } : { ...current, weeklyPlanIds: next, planRevision: current.planRevision + 1, checkedShoppingItems: [], lastPlanChange: summary });
    persistWeeklyPlan(next, summary, scope);
  }, [persistWeeklyPlan]);
  const addDynamicMeal = useCallback((meal: Meal, scope: PlanningScope = "personal") => {
    const dynamicMeals = [...(scope === "household" ? stateRef.current.householdDynamicMeals : stateRef.current.dynamicMeals).filter((item) => item.id !== meal.id), meal];
    stateRef.current = scope === "household" ? { ...stateRef.current, householdDynamicMeals: dynamicMeals } : { ...stateRef.current, dynamicMeals };
    setState((current) => scope === "household" ? { ...current, householdDynamicMeals: dynamicMeals } : { ...current, dynamicMeals });
  }, []);
  const setOptimizationObjective = useCallback((optimizationObjective: OptimizationObjective, scope: PlanningScope = "personal") => setState((current) => scope === "household" ? { ...current, householdOptimizationObjective: optimizationObjective } : { ...current, optimizationObjective }), []);
  const addPantryItems = useCallback(async (items: Omit<PantryItem, "id">[], scope: PlanningScope = "personal") => {
    if (!items.length) return false;
    if (status !== "authenticated" || stateRef.current.demoMode) {
      setState((current) => {
        const currentItems = scope === "household" ? current.householdPantryItems : current.pantryItems;
        const existing = new Set(currentItems.map((item) => item.normalizedName ?? normalizePantryName(item.name)));
        const next = items
          .filter((item) => !existing.has(item.normalizedName ?? normalizePantryName(item.name)))
          .map((item, index) => ({ ...item, normalizedName: item.normalizedName ?? normalizePantryName(item.name), id: `pantry-${Date.now()}-${index}` }));
        return scope === "household" ? { ...current, householdPantryItems: [...currentItems, ...next], householdCheckedShoppingItems: [] } : { ...current, pantryItems: [...currentItems, ...next], checkedShoppingItems: [] };
      });
      return true;
    }
    try {
      const detected = items.every((item) => item.source === "camera" || item.source === "barcode" || item.source === "ai-detected");
      if (detected) {
        const response = await fetch(scope === "household" ? "/api/households/pantry/bulk" : "/api/account/pantry/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: items.map((item) => ({ name: item.name })), source: items[0].source }),
        });
        if (!response.ok) return false;
      } else {
        const responses = await Promise.all(items.map((item) => fetch(scope === "household" ? "/api/households/pantry" : "/api/account/pantry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: item.name, quantity: item.quantity, unit: item.unit, source: item.source }),
          })));
        if (responses.some((response) => !response.ok)) return false;
      }
      await refreshAccount();
      return true;
    } catch {
      return false;
    }
  }, [refreshAccount, status]);
  const updatePantryItem = useCallback(async (id: string, changes: { name: string; quantity: number | null; unit: string | null }, scope: PlanningScope = "personal") => {
    if (status !== "authenticated" || stateRef.current.demoMode) {
      setState((current) => ({
        ...current,
        ...(scope === "household" ? { householdPantryItems: current.householdPantryItems.map((item) => item.id === id ? { ...item, ...changes, normalizedName: normalizePantryName(changes.name) } : item), householdCheckedShoppingItems: [] } : { pantryItems: current.pantryItems.map((item) => item.id === id ? { ...item, ...changes, normalizedName: normalizePantryName(changes.name) } : item), checkedShoppingItems: [] }),
      }));
      return true;
    }
    try {
      const response = await fetch(scope === "household" ? "/api/households/pantry" : "/api/account/pantry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...changes }),
      });
      if (!response.ok) return false;
      await refreshAccount();
      return true;
    } catch {
      return false;
    }
  }, [refreshAccount, status]);
  const removePantryItem = useCallback(async (id: string, scope: PlanningScope = "personal") => {
    if (status !== "authenticated" || stateRef.current.demoMode) {
      setState((current) => scope === "household" ? { ...current, householdPantryItems: current.householdPantryItems.filter((item) => item.id !== id), householdCheckedShoppingItems: [] } : { ...current, pantryItems: current.pantryItems.filter((item) => item.id !== id), checkedShoppingItems: [] });
      return true;
    }
    try {
      const response = await fetch(scope === "household" ? "/api/households/pantry" : "/api/account/pantry", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) return false;
      await refreshAccount();
      return true;
    } catch {
      return false;
    }
  }, [refreshAccount, status]);
  const setUsePantryFirst = useCallback((usePantryFirst: boolean, scope: PlanningScope = "personal") => setState((current) => scope === "household" ? { ...current, householdUsePantryFirst: usePantryFirst } : { ...current, usePantryFirst }), []);
  const toggleShoppingItem = useCallback((name: string, scope: PlanningScope = "personal") => setState((current) => {
    const items = scope === "household" ? current.householdCheckedShoppingItems : current.checkedShoppingItems;
    const next = items.includes(name) ? items.filter((item) => item !== name) : [...items, name];
    return scope === "household" ? { ...current, householdCheckedShoppingItems: next } : { ...current, checkedShoppingItems: next };
  }), []);
  const resetDiscovery = useCallback(() => setState((current) => ({ ...current, skippedIds: [], savedIds: [], weeklyPlanIds: [], dynamicMeals: [], checkedShoppingItems: [] })), []);
  const loadDemoState = useCallback(() => setState(vcDemoState()), []);
  const resetApp = useCallback(() => setState(initialState), []);

  const value = useMemo<AppContextValue>(() => ({
    ...state,
    hydrated,
    account,
    accountLoading,
    accountError,
    householdSignals: account?.householdSignals ?? {},
    refreshAccount,
    completeOnboarding,
    updateHousehold,
    likeMeal,
    skipMeal,
    removeSavedMeal,
    saveVideoMeal,
    updateVideoRecipe,
    markRecipeFailed,
    saveWeeklyPlan,
    replaceWeeklyMeal,
    swapWeeklyDays,
    moveWeeklyMeal,
    removeWeeklyMeal,
    addDynamicMeal,
    setOptimizationObjective,
    addPantryItems,
    updatePantryItem,
    removePantryItem,
    setUsePantryFirst,
    toggleShoppingItem,
    resetDiscovery,
    loadDemoState,
    resetApp,
  }), [state, hydrated, account, accountLoading, accountError, refreshAccount, completeOnboarding, updateHousehold, likeMeal, skipMeal, removeSavedMeal, saveVideoMeal, updateVideoRecipe, markRecipeFailed, saveWeeklyPlan, replaceWeeklyMeal, swapWeeklyDays, moveWeeklyMeal, removeWeeklyMeal, addDynamicMeal, setOptimizationObjective, addPantryItems, updatePantryItem, removePantryItem, setUsePantryFirst, toggleShoppingItem, resetDiscovery, loadDemoState, resetApp]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useMealApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useMealApp must be used inside AppProvider");
  return context;
}
