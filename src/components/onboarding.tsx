"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChefHat, Clock3, ImagePlus, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useMealApp } from "@/components/app-provider";
import type { Allergen, DietaryPreference, MealCategory, NutritionPreference, Preferences } from "@/types";
import { defaultPreferences } from "@/types";

const diets: DietaryPreference[] = ["Everything", "Vegetarian", "Vegan", "Pescatarian", "High protein"];
const allergens: Allergen[] = ["Dairy", "Eggs", "Gluten", "Nuts", "Shellfish", "Soy"];
const nutrition: NutritionPreference[] = ["Balanced", "High protein", "Lower carb", "None"];
const categories: { name: MealCategory; emoji: string }[] = [
  { name: "Italian", emoji: "🍅" }, { name: "Asian", emoji: "🥢" },
  { name: "Mediterranean", emoji: "🫒" }, { name: "Seafood", emoji: "🐟" },
  { name: "Vegetarian", emoji: "🥬" }, { name: "Pasta", emoji: "🍝" },
  { name: "Quick meals", emoji: "⚡" }, { name: "High protein", emoji: "💪" },
];

const toggle = <T extends string>(values: T[], value: T) => values.includes(value) ? values.filter((item) => item !== value) : [...values, value];

export function Onboarding() {
  const router = useRouter();
  const { account, accountLoading, completeOnboarding } = useMealApp();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!account) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setName((current) => current || account.user.name || "");
      setImage((current) => current ?? account.user.image);
    });
    return () => { active = false; };
  }, [account]);

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/image\/(?:png|jpe?g|webp)/.test(file.type) || file.size > 250_000) {
      setError("Choose a JPG, PNG, or WebP image smaller than 250 KB."); event.target.value = ""; return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
    });
    setImage(dataUrl); setError(null); event.target.value = "";
  };

  const next = () => {
    setError(null);
    if (step === 1 && (name.trim().length < 2 || !/^[a-z0-9._]{3,24}$/i.test(username.trim().replace(/^@/, "")))) {
      setError("Add your display name and a 3–24 character username using letters, numbers, dots, or underscores."); return;
    }
    setStep((current) => Math.min(4, current + 1));
  };

  const finish = async () => {
    setSaving(true); setError(null);
    const result = await completeOnboarding(preferences, { name: name.trim(), username: username.trim().replace(/^@/, ""), image });
    setSaving(false);
    if (!result.ok) { setError(result.message); setStep(1); return; }
    router.replace("/discover");
  };

  if (accountLoading && !account) return <main className="loading-screen"><Sparkles className="spin" /><p>Preparing your profile…</p></main>;

  return (
    <main className="onboarding preference-screen personal-onboarding">
      <section className="preference-card">
        <header className="preference-header">
          <div className="welcome-logo"><span className="brand-mark"><Sparkles size={19} /></span><span>MealSwipe</span></div>
          <div className="preference-topline"><button className="icon-button icon-button-plain" type="button" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1} aria-label="Go back"><ArrowLeft size={22} /></button><span>Personal profile · {step} of 4</span><span className="step-count">{step * 25}%</span></div>
          <div className="progress-track"><span style={{ width: `${step * 25}%` }} /></div>
        </header>
        <div className="preference-body">
          {step === 1 ? <>
            <p className="eyebrow">Make it yours</p><h1>Let&apos;s set up your profile.</h1><p className="section-intro">Your preferences belong to you. A household is optional and comes later.</p>
            <div className="profile-picture-field"><div className="profile-picture-preview">{image ? <Image src={image} alt="Your profile" fill sizes="88px" unoptimized /> : <UserRound size={32} />}</div><label className="secondary-button"><ImagePlus size={16} /> {image ? "Replace picture" : "Add picture"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /></label>{image ? <button className="link-button" type="button" onClick={() => setImage(null)}>Remove</button> : null}</div>
            <label className="compact-field"><span>Display name</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Sonia" /></label>
            <label className="compact-field"><span>Username</span><div className="username-input"><span>@</span><input autoCapitalize="none" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="sonia" /></div><small>Your username is searchable. Your email never is.</small></label>
          </> : null}
          {step === 2 ? <>
            <p className="eyebrow">Safety first</p><h1>What works for you?</h1><p className="section-intro">Allergies are hard filters in every personal plan.</p>
            <label className="compact-field"><span>Dietary preference</span><select value={preferences.dietary} onChange={(event) => setPreferences((current) => ({ ...current, dietary: event.target.value as DietaryPreference }))}>{diets.map((diet) => <option key={diet}>{diet}</option>)}</select></label>
            <div className="field-group"><label>Allergies</label><div className="chip-grid compact-chip-grid">{allergens.map((allergy) => <button type="button" key={allergy} className={`choice-chip${preferences.allergies.includes(allergy) ? " selected" : ""}`} onClick={() => setPreferences((current) => ({ ...current, allergies: toggle(current.allergies, allergy) }))}>{preferences.allergies.includes(allergy) ? <Check size={13} /> : null}{allergy}</button>)}</div></div>
            <label className="compact-field"><span>Disliked ingredients</span><input value={preferences.dislikedIngredients.join(", ")} onChange={(event) => setPreferences((current) => ({ ...current, dislikedIngredients: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }))} placeholder="mushrooms, coriander" /></label>
            <label className="onboarding-check"><input type="checkbox" checked={preferences.strictDislikes} onChange={(event) => setPreferences((current) => ({ ...current, strictDislikes: event.target.checked }))} /><span><strong>Treat dislikes as strict rules</strong><small>Recommended when you never want them in a plan.</small></span></label>
          </> : null}
          {step === 3 ? <>
            <p className="eyebrow">Your taste</p><h1>What should we prioritize?</h1><p className="section-intro">These choices improve personal recommendations and ranking.</p>
            <label className="compact-field"><span>Nutrition preference</span><select value={preferences.nutritionPreference} onChange={(event) => setPreferences((current) => ({ ...current, nutritionPreference: event.target.value as NutritionPreference }))}>{nutrition.map((option) => <option key={option}>{option}</option>)}</select></label>
            <div className="category-grid">{categories.map(({ name: category, emoji }) => { const selected = preferences.categories.includes(category); return <button key={category} type="button" className={`category-card${selected ? " selected" : ""}`} onClick={() => setPreferences((current) => ({ ...current, categories: toggle(current.categories, category) }))}><span>{emoji}</span><strong>{category}</strong>{selected ? <Check size={15} /> : null}</button>; })}</div>
          </> : null}
          {step === 4 ? <>
            <p className="eyebrow">Keep it realistic</p><h1>Your cooking rhythm.</h1><p className="section-intro">You can change these planning defaults from your profile later.</p>
            <div className="constraint-grid"><label><span>Maximum cooking time</span><input type="range" min="10" max="90" step="5" value={preferences.maximumCookingTime} onChange={(event) => setPreferences((current) => ({ ...current, maximumCookingTime: Number(event.target.value) }))} /><strong>{preferences.maximumCookingTime} min</strong></label><label><span>Dinners per week</span><input type="range" min="1" max="7" value={preferences.personalDinnersPerWeek} onChange={(event) => setPreferences((current) => ({ ...current, personalDinnersPerWeek: Number(event.target.value) }))} /><strong>{preferences.personalDinnersPerWeek}</strong></label></div>
            <div className="onboarding-value-callout"><ChefHat size={22} /><div><strong>Your personal MealSwipe is ready.</strong><span>No household is required to discover, save, plan, or shop.</span></div></div>
            <p className="plan-safety-note"><ShieldCheck size={13} /> If you join a household later, your current restrictions automatically protect shared plans.</p>
          </> : null}
          {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
        </div>
        <footer className="preference-footer">{step < 4 ? <button className="primary-button" type="button" onClick={next}>Continue <ArrowRight size={18} /></button> : <button className="primary-button" type="button" onClick={() => void finish()} disabled={saving}><Sparkles size={18} /> {saving ? "Saving…" : "Start swiping"}</button>}<span><Clock3 size={13} /> Your profile stays editable.</span></footer>
      </section>
    </main>
  );
}
