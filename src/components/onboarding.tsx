"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChefHat,
  Clock3,
  Heart,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useMealApp } from "@/components/app-provider";
import { householdPreferences } from "@/lib/meal-safety";
import type { Allergen, DietaryPreference, Household, HouseholdMember, MealCategory, NutritionPreference, Preferences } from "@/types";
import { defaultHousehold, defaultPreferences } from "@/types";

const diets: DietaryPreference[] = ["Everything", "Vegetarian", "Vegan", "Pescatarian", "High protein"];
const allergens: Allergen[] = ["Dairy", "Eggs", "Gluten", "Nuts", "Shellfish", "Soy"];
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
  return items.includes(item) ? items.filter((value) => value !== item) : [...items, item];
}

function newMember(index: number): HouseholdMember {
  return {
    id: `member-${Date.now()}-${index}`,
    name: `Person ${index + 1}`,
    dietary: "Everything",
    allergies: [],
    dislikedIngredients: [],
    nutritionPreference: "Balanced",
  };
}

export function Onboarding() {
  const router = useRouter();
  const { hydrated, hasOnboarded, completeOnboarding, loadDemoState } = useMealApp();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [household, setHousehold] = useState<Household>(() => ({
    ...defaultHousehold,
    members: defaultHousehold.members.map((member) => ({ ...member })),
    settings: { ...defaultHousehold.settings },
  }));

  const memberSummary = useMemo(() => household.members.map((member) => member.name || "Unnamed").join(" + "), [household.members]);

  const updateMember = (id: string, updates: Partial<HouseholdMember>) => {
    setHousehold((current) => ({ ...current, members: current.members.map((member) => member.id === id ? { ...member, ...updates } : member) }));
  };

  const finish = () => {
    const aggregate = householdPreferences(household, preferences);
    completeOnboarding({ ...aggregate, categories: preferences.categories }, household);
    router.push("/discover");
  };

  if (!hydrated) return <main className="onboarding onboarding-loading" />;

  if (step === 0) {
    return (
      <main className="onboarding welcome-screen">
        <div className="welcome-orb welcome-orb-one" />
        <div className="welcome-orb welcome-orb-two" />
        <section className="welcome-content">
          <div className="welcome-logo"><span className="brand-mark brand-mark-large"><Sparkles size={26} /></span><span>MealSwipe</span></div>
          <div className="welcome-visual" aria-hidden="true">
            <div className="mini-card mini-card-back"><span>One smart shop</span></div>
            <div className="mini-card mini-card-front"><div className="mini-card-photo" /><div className="mini-card-copy"><span>Miso salmon bowl</span><Heart size={16} fill="currentColor" /></div></div>
          </div>
          <div className="welcome-copy">
            <p className="eyebrow">Inspiration → dinner plan</p>
            <h1>Turn the food you want to eat into your entire week.</h1>
            <p>Swipe real cooking videos. AI builds personalized recipes, an optimized week, and one shopping list.</p>
          </div>
          <button className="primary-button primary-button-large" onClick={() => setStep(1)}>Build my household <ArrowRight size={20} /></button>
          {hasOnboarded ? <button className="link-button" type="button" onClick={() => router.push("/discover")}>Continue where I left off</button> : null}
          {process.env.NODE_ENV === "development" ? (
            <button className="demo-mode-link" type="button" onClick={() => { loadDemoState(); router.push("/week"); }}><Sparkles size={14} /> Open VC demo state</button>
          ) : null}
          <div className="benefit-row"><span><Clock3 size={16} /> Set up in 60 seconds</span><span><ShieldCheck size={16} /> Allergies first</span></div>
        </section>
      </main>
    );
  }

  return (
    <main className="onboarding preference-screen">
      <section className="preference-card household-onboarding-card">
        <header className="preference-header">
          <div className="preference-topline">
            <button className="icon-button icon-button-plain" type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} aria-label="Go back"><ArrowLeft size={22} /></button>
            <span>Step {step} of 4</span><span className="step-count">{Math.round((step / 4) * 100)}%</span>
          </div>
          <div className="progress-track"><span style={{ width: `${(step / 4) * 100}%` }} /></div>
        </header>

        <div className="preference-body">
          {step === 1 ? (
            <>
              <p className="eyebrow">Your table</p><h1>Who are we cooking for?</h1>
              <p className="section-intro">Add everyone whose needs should shape the week.</p>
              <label className="compact-field"><span>Household name</span><input value={household.name} onChange={(event) => setHousehold((current) => ({ ...current, name: event.target.value }))} /></label>
              <div className="household-member-names">
                {household.members.map((member, index) => (
                  <div className="member-name-row" key={member.id}>
                    <span><Users size={17} /></span>
                    <input aria-label={`Member ${index + 1} name`} value={member.name} onChange={(event) => updateMember(member.id, { name: event.target.value })} />
                    {household.members.length > 1 ? <button type="button" aria-label={`Remove ${member.name}`} onClick={() => setHousehold((current) => ({ ...current, members: current.members.filter((item) => item.id !== member.id) }))}><Trash2 size={16} /></button> : null}
                  </div>
                ))}
              </div>
              <button className="secondary-button add-member-button" type="button" onClick={() => setHousehold((current) => ({ ...current, members: [...current.members, newMember(current.members.length)] }))}><Plus size={16} /> Add person</button>
              <div className="household-counts">
                <label><span>Adults</span><input type="number" min="1" max="8" value={household.settings.adults} onChange={(event) => setHousehold((current) => ({ ...current, settings: { ...current.settings, adults: Number(event.target.value) } }))} /></label>
                <label><span>Children</span><input type="number" min="0" max="8" value={household.settings.children} onChange={(event) => setHousehold((current) => ({ ...current, settings: { ...current.settings, children: Number(event.target.value) } }))} /></label>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="eyebrow">Safety first</p><h1>How does everyone eat?</h1>
              <p className="section-intro">Allergies and dietary restrictions are hard rules—not suggestions.</p>
              <div className="member-restriction-list">
                {household.members.map((member) => (
                  <section className="member-restriction-card" key={member.id}>
                    <h2>{member.name || "Household member"}</h2>
                    <label className="compact-field"><span>Diet</span><select value={member.dietary} onChange={(event) => updateMember(member.id, { dietary: event.target.value as DietaryPreference })}>{diets.map((diet) => <option key={diet}>{diet}</option>)}</select></label>
                    <label className="compact-field"><span>Nutrition preference (optional)</span><select value={member.nutritionPreference} onChange={(event) => updateMember(member.id, { nutritionPreference: event.target.value as NutritionPreference })}>{["Balanced", "High protein", "Lower carb", "None"].map((option) => <option key={option}>{option}</option>)}</select></label>
                    <div className="field-group"><label>Allergies</label><div className="chip-grid compact-chip-grid">{allergens.map((allergen) => <button type="button" key={allergen} className={`choice-chip${member.allergies.includes(allergen) ? " selected" : ""}`} onClick={() => updateMember(member.id, { allergies: toggleItem(member.allergies, allergen) })}>{member.allergies.includes(allergen) ? <Check size={13} /> : null}{allergen}</button>)}</div></div>
                    <label className="compact-field"><span>Disliked ingredients</span><input placeholder="e.g. mushrooms, coriander" value={member.dislikedIngredients.join(", ")} onChange={(event) => updateMember(member.id, { dislikedIngredients: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} /></label>
                  </section>
                ))}
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="eyebrow">Follow the cravings</p><h1>What looks good?</h1>
              <p className="section-intro">Choose a few interests. Discover will learn from every swipe.</p>
              <div className="category-grid">{categories.map((category) => { const selected = preferences.categories.includes(category.name); return <button key={category.name} type="button" className={`category-card${selected ? " selected" : ""}`} onClick={() => setPreferences((current) => ({ ...current, categories: toggleItem(current.categories, category.name) }))}><span>{category.emoji}</span><strong>{category.name}</strong>{selected ? <Check size={15} /> : null}</button>; })}</div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <p className="eyebrow">Make the week realistic</p><h1>Your cooking rhythm</h1>
              <p className="section-intro">We&apos;ll optimize for {memberSummary} without making weeknights harder.</p>
              <div className="constraint-grid">
                <label><span>Dinners per week</span><input type="range" min="3" max="7" value={household.settings.dinnersPerWeek} onChange={(event) => setHousehold((current) => ({ ...current, settings: { ...current.settings, dinnersPerWeek: Number(event.target.value) } }))} /><strong>{household.settings.dinnersPerWeek}</strong></label>
                <label><span>Maximum cooking time</span><input type="range" min="15" max="60" step="5" value={household.settings.maximumCookingTime} onChange={(event) => setHousehold((current) => ({ ...current, settings: { ...current.settings, maximumCookingTime: Number(event.target.value) } }))} /><strong>{household.settings.maximumCookingTime} min</strong></label>
                <label className="compact-field"><span>Weekly food budget (optional)</span><input type="number" min="0" placeholder="€" value={household.settings.weeklyBudget ?? ""} onChange={(event) => setHousehold((current) => ({ ...current, settings: { ...current.settings, weeklyBudget: event.target.value ? Number(event.target.value) : undefined } }))} /></label>
              </div>
              <div className="onboarding-value-callout"><ChefHat size={22} /><div><strong>Swipe food you want to eat.</strong><span>We&apos;ll plan the week around it.</span></div></div>
            </>
          ) : null}
        </div>

        <footer className="preference-footer">
          {step < 4 ? <button className="primary-button" type="button" onClick={() => setStep((current) => current + 1)}>Continue <ArrowRight size={18} /></button> : <button className="primary-button" type="button" onClick={finish}><Sparkles size={18} /> Start swiping</button>}
        </footer>
      </section>
    </main>
  );
}
