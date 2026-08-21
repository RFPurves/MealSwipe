"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock3, ExternalLink, Play, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useMealApp } from "@/components/app-provider";
import { mealById } from "@/data/meals";
import { formatMetricQuantity, metricInstruction } from "@/lib/metric";

export function RecipeDetail({ mealId }: { mealId: string }) {
  const { dynamicMeals, hydrated } = useMealApp();
  const meal = dynamicMeals.find((item) => item.id === mealId) ?? mealById.get(mealId);

  if (!hydrated) return <div className="recipe-detail-loading">Loading recipe…</div>;
  if (!meal) {
    return (
      <section className="saved-empty">
        <h2>Recipe not found</h2>
        <p>This saved recipe may have been removed from this browser.</p>
        <Link className="primary-button" href="/saved">Back to Saved</Link>
      </section>
    );
  }

  const aiGenerated = meal.recipeOrigin === "ai-estimated";
  const metadataFallback = meal.recipeOrigin === "fallback-estimated";
  const combined = meal.recipeOrigin === "combined";
  const sourcePlatform = meal.source?.platform ?? (meal.sourceType === "youtube" ? "youtube" : "curated");
  const generationLabel = combined
    ? "Combined recipe"
    : aiGenerated
      ? "AI-estimated recipe"
      : metadataFallback
        ? "Metadata estimate"
        : "Curated recipe";
  return (
    <article className="recipe-detail">
      <Link className="recipe-back" href="/saved"><ArrowLeft size={16} /> Saved meals</Link>
      <div className="recipe-hero">
        {meal.youtubeVideoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${meal.youtubeVideoId}?playsinline=1&rel=0`}
            title={`${meal.title} by ${meal.channelTitle}`}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <Image src={meal.image} alt={meal.title} fill sizes="570px" priority />
        )}
        {meal.youtubeVideoId ? <span className="recipe-video-label"><Play size={12} fill="currentColor" /> Source video</span> : null}
      </div>
      <div className="recipe-title-block">
        <p className="eyebrow">{meal.category}</p>
        <h1>{meal.title}</h1>
        {meal.channelTitle ? <p className="recipe-creator">Recipe inspired by {meal.channelTitle}</p> : null}
        <p>{meal.description}</p>
        <div className="recipe-facts">
          <span><Clock3 size={15} /> {meal.timeMinutes} min</span>
          <span><Users size={15} /> {meal.servings} servings</span>
          {meal.proteinGrams > 0 ? <span>{meal.proteinGrams}g protein</span> : null}
        </div>
      </div>

      {meal.sourceType === "youtube" ? (
        <div className={`recipe-safety-callout ${meal.safetyStatus === "safe" ? "is-safe" : "is-review"}`}>
          {meal.safetyStatus === "safe" ? <ShieldCheck size={20} /> : <AlertTriangle size={20} />}
          <div>
            <strong>{meal.safetyStatus === "safe" ? "Checked against your household" : "Review this recipe before planning"}</strong>
            <p>{meal.safetyNotes?.[0] ?? "Video recipes can contain ingredients not listed in their metadata."}</p>
          </div>
        </div>
      ) : null}

      {meal.sourceType === "youtube" ? (
        <section className="recipe-panel recipe-source-panel">
          <div className="recipe-panel-heading">
            <div><p className="eyebrow">Recipe provenance</p><h2>Source &amp; safety</h2></div>
            <span><Sparkles size={12} /> {generationLabel}</span>
          </div>
          <div className="recipe-meta-grid">
            <div><span>Platform</span><strong>{titleCase(sourcePlatform)}</strong></div>
            <div><span>Source ID</span><strong>{meal.source?.contentId ?? meal.youtubeVideoId ?? "Cached demo source"}</strong></div>
            <div><span>Creator</span><strong>{meal.source?.creator ?? meal.channelTitle ?? "MealSwipe"}</strong></div>
            <div><span>Original title</span><strong>{meal.source?.originalTitle ?? meal.title}</strong></div>
            <div><span>Dietary tags</span><strong>{meal.dietary.length ? meal.dietary.join(", ") : "No specific diet"}</strong></div>
            <div><span>Allergens</span><strong>{meal.allergens.length ? meal.allergens.join(", ") : "None declared"}</strong></div>
          </div>
        </section>
      ) : null}

      <section className="recipe-panel">
        <div className="recipe-panel-heading">
          <div><p className="eyebrow">Mise en place</p><h2>Ingredients</h2></div>
          {aiGenerated ? <span><Sparkles size={12} /> AI generated</span> : null}
          {metadataFallback ? <span><Sparkles size={12} /> Estimated fallback</span> : null}
        </div>
        <div className="recipe-ingredients">
          {meal.ingredients.map((ingredient) => (
            <div key={ingredient.name}>
              <span>{ingredient.name}</span>
              <strong>{formatMetricQuantity(ingredient.amount, ingredient.unit)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="recipe-panel">
        <div className="recipe-panel-heading"><div><p className="eyebrow">Cook along</p><h2>Method</h2></div></div>
        <ol className="recipe-method">
          {(meal.instructions ?? ["Prepare the ingredients.", "Follow the source recipe and cook until done."]).map((instruction, index) => (
            <li key={`${index}-${instruction}`}><span>{index + 1}</span><p>{metricInstruction(instruction)}</p></li>
          ))}
        </ol>
      </section>

      {meal.youtubeUrl ? (
        <a className="youtube-source-link" href={meal.youtubeUrl} target="_blank" rel="noreferrer">
          Watch original on YouTube <ExternalLink size={15} />
        </a>
      ) : null}
      {aiGenerated && meal.source?.url ? <p className="recipe-estimate-note">OpenAI generated this structured recipe from the creator&apos;s public video metadata. Quantities remain estimates; the original video is the source of truth.</p> : null}
      {aiGenerated && !meal.source?.url ? <p className="recipe-estimate-note">This cached demo recipe keeps its platform and creator attribution, but does not depend on a live source link. Ingredients and quantities remain clearly marked as estimates.</p> : null}
      {metadataFallback ? <p className="recipe-estimate-note">OpenAI was unavailable, so these details are a metadata-based fallback. Review them against the original video before cooking.</p> : null}
    </article>
  );
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
