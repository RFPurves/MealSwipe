"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  Heart,
  LoaderCircle,
  Play,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useMealApp } from "@/components/app-provider";
import { mealById } from "@/data/meals";

export function SavedMeals() {
  const { savedIds, dynamicMeals, removeSavedMeal } = useMealApp();
  const dynamicById = new Map(dynamicMeals.map((meal) => [meal.id, meal]));
  const savedMeals = savedIds.flatMap((id) => {
    const meal = dynamicById.get(id) ?? mealById.get(id);
    return meal ? [meal] : [];
  });

  if (savedMeals.length === 0) {
    return (
      <section className="saved-empty">
        <div className="empty-heart"><Heart size={35} /></div>
        <h2>Nothing saved yet</h2>
        <p>Your right swipes will live here, ready to become your weekly plan.</p>
        <Link className="primary-button" href="/discover">Discover meals</Link>
      </section>
    );
  }

  return (
    <section className="saved-section">
      <p className="saved-intro">
        Your shortlist is taking shape. Video recipes keep preparing while you browse.
      </p>
      <div className="saved-grid">
        {savedMeals.map((meal, index) => (
          <article className="saved-card" key={meal.id}>
            <div className="saved-card-image">
              <Image
                src={meal.image}
                alt={meal.title}
                fill
                loading={index === 0 ? "eager" : "lazy"}
                sizes="(max-width: 700px) 45vw, 280px"
              />
              <span>{meal.category}</span>
              {meal.sourceType === "youtube" ? (
                <span className="video-source-badge"><Play size={10} fill="currentColor" /> Video</span>
              ) : null}
              <button
                type="button"
                onClick={() => removeSavedMeal(meal.id)}
                aria-label={`Remove ${meal.title} from saved meals`}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <div className="saved-card-copy">
              <h2>{meal.title}</h2>
              {meal.recipeStatus === "creating" ? (
                <div className="recipe-state is-creating"><LoaderCircle className="spin" size={14} /> Creating recipe…</div>
              ) : meal.recipeStatus === "failed" ? (
                <div className="recipe-state is-review"><AlertTriangle size={14} /> Recipe needs review</div>
              ) : (
                <>
                  <p><Clock3 size={14} /> {meal.timeMinutes} min{meal.proteinGrams > 0 ? ` · ${meal.proteinGrams}g protein` : ""}</p>
                  <div className="ingredient-preview">
                    {meal.ingredients.slice(0, 3).map((ingredient) => (
                      <span key={ingredient.name}>{ingredient.name}</span>
                    ))}
                    {meal.ingredients.length > 3 ? <span>+{meal.ingredients.length - 3}</span> : null}
                  </div>
                </>
              )}
              {meal.sourceType === "youtube" && meal.recipeStatus === "ready" ? (
                <div className={`saved-safety ${meal.safetyStatus === "safe" ? "is-safe" : "is-review"}`}>
                  {meal.safetyStatus === "safe" ? <ShieldCheck size={13} /> : <AlertTriangle size={13} />}
                  {meal.safetyStatus === "safe" ? "Preference checked" : "Review before planning"}
                </div>
              ) : null}
              {meal.recipeStatus !== "creating" ? (
                <Link className="recipe-card-link" href={`/saved/${encodeURIComponent(meal.id)}`}>
                  View recipe <ArrowRight size={14} />
                </Link>
              ) : null}
            </div>
          </article>
        ))}
        <Link className="saved-card add-more-card" href="/discover">
          <Plus size={25} />
          <span>Add another meal</span>
        </Link>
      </div>
    </section>
  );
}
