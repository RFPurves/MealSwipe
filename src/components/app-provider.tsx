"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Meal, Preferences, YouTubeMealCandidate } from "@/types";
import { defaultPreferences } from "@/types";

const STORAGE_KEY = "meal-swipe-state-v3";
const LEGACY_STORAGE_KEYS = ["meal-swipe-state-v2", "meal-swipe-state-v1"];

interface StoredState {
  hasOnboarded: boolean;
  preferences: Preferences;
  savedIds: string[];
  skippedIds: string[];
  weeklyPlanIds: string[];
  planRevision: number;
  dynamicMeals: Meal[];
  checkedShoppingItems: string[];
}

interface AppContextValue extends StoredState {
  hydrated: boolean;
  completeOnboarding: (preferences: Preferences) => void;
  likeMeal: (id: string) => void;
  skipMeal: (id: string) => void;
  removeSavedMeal: (id: string) => void;
  saveVideoMeal: (candidate: YouTubeMealCandidate) => string;
  updateVideoRecipe: (id: string, meal: Meal) => void;
  markRecipeFailed: (id: string) => void;
  saveWeeklyPlan: (mealIds: string[]) => void;
  replaceWeeklyMeal: (dayIndex: number, mealId: string) => void;
  toggleShoppingItem: (name: string) => void;
  resetDiscovery: () => void;
  resetApp: () => void;
}

const initialState: StoredState = {
  hasOnboarded: false,
  preferences: defaultPreferences,
  savedIds: [],
  skippedIds: [],
  weeklyPlanIds: [],
  planRevision: 0,
  dynamicMeals: [],
  checkedShoppingItems: [],
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      try {
        const stored =
          window.localStorage.getItem(STORAGE_KEY) ??
          LEGACY_STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
        if (stored) {
          setState({ ...initialState, ...(JSON.parse(stored) as StoredState) });
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
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [hydrated, state]);

  const completeOnboarding = useCallback((preferences: Preferences) => {
    setState((current) => ({
      ...current,
      hasOnboarded: true,
      preferences,
      weeklyPlanIds: [],
      checkedShoppingItems: [],
    }));
  }, []);

  const likeMeal = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      savedIds: current.savedIds.includes(id)
        ? current.savedIds
        : [...current.savedIds, id],
      skippedIds: current.skippedIds.filter((mealId) => mealId !== id),
    }));
  }, []);

  const skipMeal = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      skippedIds: current.skippedIds.includes(id)
        ? current.skippedIds
        : [...current.skippedIds, id],
    }));
  }, []);

  const removeSavedMeal = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      savedIds: current.savedIds.filter((mealId) => mealId !== id),
    }));
  }, []);

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
        servings: 2,
        dietary: [],
        allergens: [],
        ingredients: [],
        sourceType: "youtube",
        youtubeVideoId: candidate.videoId,
        youtubeUrl: candidate.sourceUrl,
        channelTitle: candidate.channelTitle,
        sourceDescription: candidate.description,
        recipeStatus: "creating",
        recipeOrigin: "fallback-estimated",
        safetyStatus: "review-needed",
        safetyNotes: ["Recipe details are still being created."],
      };

      return {
        ...current,
        savedIds: current.savedIds.includes(id) ? current.savedIds : [...current.savedIds, id],
        skippedIds: current.skippedIds.filter((mealId) => mealId !== id),
        dynamicMeals: existing ? current.dynamicMeals : [...current.dynamicMeals, placeholder],
      };
    });
    return id;
  }, []);

  const updateVideoRecipe = useCallback((id: string, meal: Meal) => {
    setState((current) => ({
      ...current,
      dynamicMeals: current.dynamicMeals.map((existing) =>
        existing.id === id ? { ...meal, id } : existing,
      ),
    }));
  }, []);

  const markRecipeFailed = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      dynamicMeals: current.dynamicMeals.map((meal) =>
        meal.id === id
          ? {
              ...meal,
              recipeStatus: "failed",
              safetyStatus: "review-needed",
              safetyNotes: ["We could not verify this recipe. Review the source before cooking."],
            }
          : meal,
      ),
    }));
  }, []);

  const saveWeeklyPlan = useCallback((mealIds: string[]) => {
    setState((current) => ({
      ...current,
      weeklyPlanIds: mealIds,
      planRevision: current.planRevision + 1,
      checkedShoppingItems: [],
    }));
  }, []);

  const replaceWeeklyMeal = useCallback((dayIndex: number, mealId: string) => {
    setState((current) => ({
      ...current,
      weeklyPlanIds: current.weeklyPlanIds.map((id, index) =>
        index === dayIndex ? mealId : id,
      ),
      planRevision: current.planRevision + 1,
      checkedShoppingItems: [],
    }));
  }, []);

  const toggleShoppingItem = useCallback((name: string) => {
    setState((current) => ({
      ...current,
      checkedShoppingItems: current.checkedShoppingItems.includes(name)
        ? current.checkedShoppingItems.filter((item) => item !== name)
        : [...current.checkedShoppingItems, name],
    }));
  }, []);

  const resetDiscovery = useCallback(() => {
    setState((current) => ({
      ...current,
      skippedIds: [],
      savedIds: [],
      weeklyPlanIds: [],
      dynamicMeals: [],
      checkedShoppingItems: [],
    }));
  }, []);

  const resetApp = useCallback(() => {
    setState(initialState);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      ...state,
      hydrated,
      completeOnboarding,
      likeMeal,
      skipMeal,
      removeSavedMeal,
      saveVideoMeal,
      updateVideoRecipe,
      markRecipeFailed,
      saveWeeklyPlan,
      replaceWeeklyMeal,
      toggleShoppingItem,
      resetDiscovery,
      resetApp,
    }),
    [
      state,
      hydrated,
      completeOnboarding,
      likeMeal,
      skipMeal,
      removeSavedMeal,
      saveVideoMeal,
      updateVideoRecipe,
      markRecipeFailed,
      saveWeeklyPlan,
      replaceWeeklyMeal,
      toggleShoppingItem,
      resetDiscovery,
      resetApp,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useMealApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useMealApp must be used inside AppProvider");
  }
  return context;
}
