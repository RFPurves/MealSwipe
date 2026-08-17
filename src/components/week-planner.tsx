"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  Clock3,
  Heart,
  RefreshCw,
  Repeat2,
  ShoppingBasket,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useMealApp } from "@/components/app-provider";
import { mealById } from "@/data/meals";
import {
  buildShoppingList,
  findReplacementMeal,
  formatShoppingAmount,
  generateWeeklyPlan,
  getIngredientReuseStats,
  getSafeMealPool,
  SHOPPING_CATEGORY_ORDER,
  WEEKDAYS,
} from "@/lib/meal-planner";
import { mealIsSafe } from "@/lib/meal-safety";
import type { ShoppingCategory } from "@/types";

const categoryIcons: Record<ShoppingCategory, string> = {
  Produce: "🥬",
  Protein: "🥚",
  Dairy: "🥛",
  Grains: "🌾",
  Pantry: "🫙",
  Other: "✦",
};

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function WeekPlanner() {
  const {
    preferences,
    savedIds,
    weeklyPlanIds,
    planRevision,
    dynamicMeals,
    checkedShoppingItems,
    saveWeeklyPlan,
    replaceWeeklyMeal,
    toggleShoppingItem,
  } = useMealApp();
  const [isGenerating, setIsGenerating] = useState(false);
  const [replacingDay, setReplacingDay] = useState<number | null>(null);
  const generationTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (generationTimer.current !== undefined) {
        window.clearTimeout(generationTimer.current);
      }
    },
    [],
  );

  const dynamicById = useMemo(
    () => new Map(dynamicMeals.map((meal) => [meal.id, meal])),
    [dynamicMeals],
  );
  const safeMeals = useMemo(
    () => getSafeMealPool(preferences, dynamicMeals),
    [dynamicMeals, preferences],
  );
  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);
  const checkedItems = useMemo(() => new Set(checkedShoppingItems), [checkedShoppingItems]);
  const safeSavedCount = useMemo(
    () => savedIds.filter((id) => {
      const meal = dynamicById.get(id) ?? mealById.get(id);
      return meal ? mealIsSafe(meal, preferences) : false;
    }).length,
    [dynamicById, preferences, savedIds],
  );
  const planMeals = useMemo(
    () => weeklyPlanIds.flatMap((id) => {
      const meal = dynamicById.get(id) ?? mealById.get(id);
      return meal && mealIsSafe(meal, preferences) ? [meal] : [];
    }),
    [dynamicById, preferences, weeklyPlanIds],
  );
  const hasCompletePlan = planMeals.length === WEEKDAYS.length;
  const reuseStats = useMemo(() => getIngredientReuseStats(planMeals), [planMeals]);
  const shoppingList = useMemo(() => buildShoppingList(planMeals), [planMeals]);
  const groupedShopping = useMemo(
    () =>
      SHOPPING_CATEGORY_ORDER.map((category) => ({
        category,
        items: shoppingList.filter((item) => item.category === category),
      })).filter((group) => group.items.length > 0),
    [shoppingList],
  );

  const generate = () => {
    if (safeMeals.length === 0 || isGenerating) return;
    setIsGenerating(true);
    if (generationTimer.current !== undefined) {
      window.clearTimeout(generationTimer.current);
    }
    generationTimer.current = window.setTimeout(() => {
      const mealIds = generateWeeklyPlan(
        savedIds,
        preferences,
        planRevision + 1,
        dynamicMeals,
      );
      saveWeeklyPlan(mealIds);
      setIsGenerating(false);
      generationTimer.current = undefined;
    }, 480);
  };

  const replaceDay = (dayIndex: number) => {
    if (replacingDay !== null) return;
    setReplacingDay(dayIndex);
    const replacement = findReplacementMeal(
      planMeals,
      dayIndex,
      savedIds,
      preferences,
      planRevision + 1,
      dynamicMeals,
    );
    if (replacement) replaceWeeklyMeal(dayIndex, replacement.id);
    window.setTimeout(() => setReplacingDay(null), 260);
  };

  if (!hasCompletePlan) {
    return (
      <section className="week-planner">
        <div className="plan-intro-card">
          <div className="plan-intro-art" aria-hidden="true">
            <div className="plan-orbit plan-orbit-one" />
            <div className="plan-orbit plan-orbit-two" />
            <span className="plan-spark plan-spark-one"><Sparkles size={18} /></span>
            <span className="plan-spark plan-spark-two"><Sparkles size={13} /></span>
            <div className="plan-calendar-icon">
              <CalendarDays size={34} />
              <span>7</span>
            </div>
          </div>
          <p className="eyebrow">Your smart menu</p>
          <h2>Seven dinners. One clever shop.</h2>
          <p className="plan-intro-copy">
            We&apos;ll start with your favourites, add safe recommendations when
            needed, and choose meals that share ingredients.
          </p>

          <div className="plan-source-row">
            <div>
              <Heart size={17} fill="currentColor" />
              <span><strong>{safeSavedCount}</strong> safe favourite{safeSavedCount === 1 ? "" : "s"}</span>
            </div>
            <div>
              <WandSparkles size={17} />
              <span><strong>{Math.max(0, 7 - safeSavedCount)}</strong> smart pick{Math.max(0, 7 - safeSavedCount) === 1 ? "" : "s"}</span>
            </div>
          </div>

          {safeMeals.length > 0 ? (
            <button className="generate-week-button" type="button" onClick={generate} disabled={isGenerating}>
              {isGenerating ? (
                <><RefreshCw className="spin" size={20} /> Building your week…</>
              ) : (
                <><Sparkles size={20} /> Generate My Week</>
              )}
            </button>
          ) : (
            <div className="no-safe-meals">
              <strong>No safe matches available</strong>
              <p>Your current restrictions exclude every starter meal.</p>
              <Link href="/">Adjust preferences</Link>
            </div>
          )}

          <p className="plan-safety-note">
            <Check size={13} /> Allergies and dietary restrictions are always hard filters.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="week-planner week-planner-generated">
      <div className="plan-payoff">
        <div className="plan-payoff-top">
          <div>
            <p className="eyebrow">Your week is ready</p>
            <h2>Cook more. Shop less.</h2>
          </div>
          <span className="payoff-check"><Check size={19} /></span>
        </div>
        <div className="reuse-number">
          <strong>{reuseStats.sharedIngredientCount}</strong>
          <span>ingredients used across multiple meals</span>
        </div>
        {reuseStats.sharedIngredients.length > 0 ? (
          <div className="reuse-pills">
            {reuseStats.sharedIngredients.slice(0, 4).map((ingredient) => (
              <span key={ingredient.name}>
                {titleCase(ingredient.name)} <b>×{ingredient.count}</b>
              </span>
            ))}
          </div>
        ) : (
          <p className="reuse-fallback">Maximum variety this week with no repeated meals.</p>
        )}
        <div className="payoff-footer">
          <span>{reuseStats.reusedOccurrences} repeat purchases avoided</span>
          <button type="button" onClick={generate} disabled={isGenerating}>
            <RefreshCw className={isGenerating ? "spin" : ""} size={15} />
            Regenerate
          </button>
        </div>
      </div>

      <div className="week-list-heading">
        <div>
          <p className="eyebrow">Monday to Sunday</p>
          <h2>Your dinner plan</h2>
        </div>
        <span>{safeSavedCount} liked</span>
      </div>

      <div className="day-card-list">
        {planMeals.map((meal, dayIndex) => (
          <article className={`day-meal-card${replacingDay === dayIndex ? " is-replacing" : ""}`} key={`${WEEKDAYS[dayIndex]}-${meal.id}`}>
            <div className="day-meal-image">
              <Image
                src={meal.image}
                alt={meal.title}
                fill
                loading={dayIndex === 0 ? "eager" : "lazy"}
                sizes="(max-width: 760px) 116px, 132px"
              />
              <span>{dayIndex + 1}</span>
            </div>
            <div className="day-meal-content">
              <div className="day-label-row">
                <p>{WEEKDAYS[dayIndex]}</p>
                {savedSet.has(meal.id) ? <span><Heart size={10} fill="currentColor" /> Liked</span> : <span className="smart-pick"><Sparkles size={10} /> Smart pick</span>}
              </div>
              <h3>{meal.title}</h3>
              <p className="day-time"><Clock3 size={13} /> {meal.timeMinutes} min</p>
              <div className="day-ingredients">
                {meal.ingredients.slice(0, 3).map((ingredient) => (
                  <span key={ingredient.name}>{ingredient.name}</span>
                ))}
              </div>
              <div className="day-card-bottom">
                <div className="dietary-tags">
                  {meal.dietary.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <button type="button" onClick={() => replaceDay(dayIndex)} aria-label={`Replace ${meal.title} on ${WEEKDAYS[dayIndex]}`}>
                  <Repeat2 size={15} /> Replace
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="shopping-list-card">
        <header className="shopping-header">
          <div className="shopping-icon"><ShoppingBasket size={23} /></div>
          <div>
            <p className="eyebrow">Combined for 7 dinners</p>
            <h2>Shopping list</h2>
          </div>
          <span>{checkedItems.size}/{shoppingList.length}</span>
        </header>
        <div className="shopping-progress">
          <span style={{ width: `${shoppingList.length ? (checkedItems.size / shoppingList.length) * 100 : 0}%` }} />
        </div>
        <p className="shopping-summary">
          Duplicate ingredients are merged. Quantities come directly from the recipes.
        </p>

        <div className="shopping-groups">
          {groupedShopping.map(({ category, items }) => (
            <section className="shopping-group" key={category}>
              <header>
                <span>{categoryIcons[category]}</span>
                <h3>{category}</h3>
                <small>{items.length}</small>
              </header>
              <div>
                {items.map((item) => {
                  const checked = checkedItems.has(item.name);
                  const amount = formatShoppingAmount(item);
                  return (
                    <button
                      className={`shopping-item${checked ? " is-checked" : ""}${item.mealCount > 1 ? " is-shared" : ""}`}
                      key={item.name}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleShoppingItem(item.name)}
                    >
                      <span className="shopping-check">{checked ? <Check size={13} /> : null}</span>
                      <span className="shopping-item-copy">
                        <strong>{titleCase(item.name)}</strong>
                        <small>
                          {amount ? `${amount} · ` : ""}
                          {item.mealCount > 1 ? `Used in ${item.mealCount} meals` : "Used in 1 meal"}
                        </small>
                      </span>
                      {item.mealCount > 1 ? <b>REUSE</b> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>
    </section>
  );
}
