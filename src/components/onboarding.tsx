"use client";

import { useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  Heart,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { useMealApp } from "@/components/app-provider";
import type {
  Allergen,
  DietaryPreference,
  MealCategory,
  Preferences,
} from "@/types";
import { defaultPreferences } from "@/types";

const diets: { name: DietaryPreference; detail: string; symbol: string }[] = [
  { name: "Everything", detail: "Show me the full menu", symbol: "✦" },
  { name: "Vegetarian", detail: "No meat or fish", symbol: "◌" },
  { name: "Vegan", detail: "Plants only", symbol: "◇" },
  { name: "Pescatarian", detail: "Vegetarian + seafood", symbol: "≈" },
  { name: "High protein", detail: "Protein-forward picks", symbol: "↑" },
];

const allergens: Allergen[] = [
  "Dairy",
  "Eggs",
  "Gluten",
  "Nuts",
  "Shellfish",
  "Soy",
];

const dislikedSuggestions = [
  "Mushrooms",
  "Olives",
  "Coriander",
  "Tofu",
  "Avocado",
];

const categories: { name: MealCategory; emoji: string }[] = [
  { name: "Italian", emoji: "🍅" },
  { name: "Asian", emoji: "🥢" },
  { name: "Mediterranean", emoji: "🫒" },
  { name: "Seafood", emoji: "🐟" },
  { name: "Vegetarian", emoji: "🥬" },
  { name: "Pasta", emoji: "🍝" },
  { name: "Quick meals", emoji: "⚡" },
  { name: "High protein", emoji: "💪" },
];

function toggleItem<T extends string>(items: T[], item: T) {
  return items.includes(item)
    ? items.filter((value) => value !== item)
    : [...items, item];
}

export function Onboarding() {
  const router = useRouter();
  const { hydrated, hasOnboarded, completeOnboarding } = useMealApp();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] =
    useState<Preferences>(defaultPreferences);
  const [customDislike, setCustomDislike] = useState("");

  const addDislike = (value = customDislike) => {
    const normalized = value.trim();
    if (
      normalized &&
      !preferences.dislikedIngredients.some(
        (item) => item.toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      setPreferences((current) => ({
        ...current,
        dislikedIngredients: [...current.dislikedIngredients, normalized],
      }));
    }
    setCustomDislike("");
  };

  const handleDislikeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addDislike();
    }
  };

  const finish = () => {
    completeOnboarding(preferences);
    router.push("/discover");
  };

  if (!hydrated) {
    return <main className="onboarding onboarding-loading" />;
  }

  if (step === 0) {
    return (
      <main className="onboarding welcome-screen">
        <div className="welcome-orb welcome-orb-one" />
        <div className="welcome-orb welcome-orb-two" />
        <section className="welcome-content">
          <div className="welcome-logo">
            <span className="brand-mark brand-mark-large">
              <Sparkles size={26} />
            </span>
            <span>MealSwipe</span>
          </div>
          <div className="welcome-visual" aria-hidden="true">
            <div className="mini-card mini-card-back">
              <span>20 min</span>
            </div>
            <div className="mini-card mini-card-front">
              <div className="mini-card-photo" />
              <div className="mini-card-copy">
                <span>Miso salmon bowl</span>
                <Heart size={16} fill="currentColor" />
              </div>
            </div>
          </div>
          <div className="welcome-copy">
            <p className="eyebrow">Swipe. Save. Savour.</p>
            <h1>Your weekly menu should feel this easy.</h1>
            <p>
              Discover craveable meals, save your favourites, and turn them into
              a week you&apos;ll look forward to.
            </p>
          </div>
          <button className="primary-button primary-button-large" onClick={() => setStep(1)}>
            Find my meals <ArrowRight size={20} />
          </button>
          {hasOnboarded ? (
            <button className="link-button" type="button" onClick={() => router.push("/discover")}>
              Continue where I left off
            </button>
          ) : null}
          <div className="benefit-row">
            <span><Clock3 size={16} /> Takes 60 seconds</span>
            <span><ChefHat size={16} /> 18 curated ideas</span>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding preference-screen">
      <section className="preference-card">
        <header className="preference-header">
          <div className="preference-topline">
            <button
              className="icon-button icon-button-plain"
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              aria-label="Go back"
            >
              <ArrowLeft size={22} />
            </button>
            <span>Step {step} of 3</span>
            <span className="step-count">{Math.round((step / 3) * 100)}%</span>
          </div>
          <div className="progress-track">
            <span style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </header>

        <div className="preference-body">
          {step === 1 ? (
            <>
              <p className="eyebrow">First things first</p>
              <h1>How do you like to eat?</h1>
              <p className="section-intro">Pick the option that fits you best. You can change it later.</p>
              <div className="diet-list">
                {diets.map((diet) => {
                  const selected = preferences.dietary === diet.name;
                  return (
                    <button
                      key={diet.name}
                      type="button"
                      className={`select-row${selected ? " selected" : ""}`}
                      onClick={() =>
                        setPreferences((current) => ({ ...current, dietary: diet.name }))
                      }
                    >
                      <span className="select-symbol">{diet.symbol}</span>
                      <span className="select-copy">
                        <strong>{diet.name}</strong>
                        <small>{diet.detail}</small>
                      </span>
                      <span className="radio-mark">{selected ? <Check size={15} /> : null}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="eyebrow">Make it yours</p>
              <h1>Anything we should avoid?</h1>
              <p className="section-intro">We&apos;ll hide meals containing your allergens or dislikes.</p>

              <div className="field-group">
                <label>Allergies</label>
                <div className="chip-grid">
                  {allergens.map((allergen) => {
                    const selected = preferences.allergies.includes(allergen);
                    return (
                      <button
                        type="button"
                        key={allergen}
                        className={`choice-chip${selected ? " selected" : ""}`}
                        onClick={() =>
                          setPreferences((current) => ({
                            ...current,
                            allergies: toggleItem(current.allergies, allergen),
                          }))
                        }
                      >
                        {selected ? <Check size={14} /> : null}{allergen}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field-group">
                <label htmlFor="dislike-input">Disliked ingredients</label>
                <div className="input-with-button">
                  <input
                    id="dislike-input"
                    value={customDislike}
                    onChange={(event) => setCustomDislike(event.target.value)}
                    onKeyDown={handleDislikeKeyDown}
                    placeholder="e.g. aubergine"
                  />
                  <button type="button" onClick={() => addDislike()} aria-label="Add disliked ingredient">
                    <Plus size={19} />
                  </button>
                </div>
                <div className="suggestion-row">
                  {dislikedSuggestions.map((item) => {
                    const selected = preferences.dislikedIngredients.includes(item);
                    return (
                      <button
                        type="button"
                        key={item}
                        className={`suggestion-chip${selected ? " selected" : ""}`}
                        onClick={() =>
                          setPreferences((current) => ({
                            ...current,
                            dislikedIngredients: toggleItem(
                              current.dislikedIngredients,
                              item,
                            ),
                          }))
                        }
                      >
                        {item}{selected ? <X size={12} /> : <Plus size={12} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="eyebrow">Last one</p>
              <h1>What sounds good?</h1>
              <p className="section-intro">Choose as many as you like, or leave blank to see everything.</p>
              <div className="category-grid">
                {categories.map((category) => {
                  const selected = preferences.categories.includes(category.name);
                  return (
                    <button
                      type="button"
                      key={category.name}
                      className={`category-tile${selected ? " selected" : ""}`}
                      onClick={() =>
                        setPreferences((current) => ({
                          ...current,
                          categories: toggleItem(current.categories, category.name),
                        }))
                      }
                    >
                      <span>{category.emoji}</span>
                      <strong>{category.name}</strong>
                      <i>{selected ? <Check size={13} /> : null}</i>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        <footer className="preference-footer">
          <button
            className="primary-button primary-button-large"
            type="button"
            onClick={step === 3 ? finish : () => setStep((current) => current + 1)}
          >
            {step === 3 ? "Start swiping" : "Continue"}
            {step === 3 ? <Sparkles size={19} /> : <ArrowRight size={19} />}
          </button>
          {step === 2 ? (
            <button className="link-button" type="button" onClick={() => setStep(3)}>
              Nothing to avoid
            </button>
          ) : null}
        </footer>
      </section>
    </main>
  );
}
