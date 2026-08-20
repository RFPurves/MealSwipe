"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { signOut, useSession } from "next-auth/react";
import { Bell, Check, ChevronRight, ImagePlus, LoaderCircle, LogOut, ShieldCheck, Sparkles, Users } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { useMealApp } from "@/components/app-provider";

const allergyOptions = ["Dairy", "Eggs", "Gluten", "Nuts", "Shellfish", "Soy"];
const nutritionOptions = ["Balanced", "High protein", "Lower carb", "None"];

export function AccountDashboard() {
  const { status } = useSession();
  const { account, accountLoading, accountError, refreshAccount } = useMealApp();
  const [username, setUsername] = useState(""); const [name, setName] = useState(""); const [image, setImage] = useState<string | null>(null);
  const [dietary, setDietary] = useState("Everything"); const [nutrition, setNutrition] = useState("Balanced");
  const [allergies, setAllergies] = useState<string[]>([]); const [dislikes, setDislikes] = useState("");
  const [maximumCookingTime, setMaximumCookingTime] = useState(45); const [personalDinnersPerWeek, setPersonalDinnersPerWeek] = useState(7); const [strictDislikes, setStrictDislikes] = useState(true);
  const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setUsername(account.user.username ?? ""); setName(account.user.name); setImage(account.user.image);
      setDietary(account.preferences.dietary); setNutrition(account.preferences.nutritionPreference ?? "Balanced"); setAllergies(account.preferences.allergies);
      setDislikes(account.preferences.dislikedIngredients.join(", ")); setMaximumCookingTime(account.preferences.maximumCookingTime ?? 45);
      setPersonalDinnersPerWeek(account.preferences.personalDinnersPerWeek ?? 7); setStrictDislikes(account.preferences.strictDislikes ?? true);
    });
    return () => { active = false; };
  }, [account]);

  const mutate = async (url: string, init: RequestInit, success: string) => {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "That could not be completed.");
      setMessage(success); await refreshAccount(); return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "That could not be completed."); return false; }
    finally { setBusy(false); }
  };

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    if (!/image\/(?:png|jpe?g|webp)/.test(file.type) || file.size > 250_000) { setMessage("Choose a JPG, PNG, or WebP image smaller than 250 KB."); event.target.value = ""; return; }
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    setImage(dataUrl); setMessage("Picture ready. Save your profile to keep it."); event.target.value = "";
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    await mutate("/api/account/profile", { method: "PATCH", body: JSON.stringify({ username, name, image, preferences: { dietary, nutritionPreference: nutrition, allergies, dislikedIngredients: dislikes.split(",").map((item) => item.trim()).filter(Boolean), categories: account?.preferences.categories ?? [], maximumCookingTime, personalDinnersPerWeek, strictDislikes } }) }, "Profile and planning preferences saved.");
  };

  if (status === "loading" || accountLoading || (status === "authenticated" && !account && !accountError)) return <main className="loading-screen"><LoaderCircle className="spin" /><p>Loading your profile…</p></main>;
  if (status !== "authenticated") return <main className="auth-page"><section className="auth-card"><div className="auth-mark"><Sparkles /></div><h1>Sign in to MealSwipe</h1><Link className="primary-button" href="/auth/signin">Continue</Link></section></main>;
  if (!account) return <main className="auth-page"><section className="auth-card"><h1>We couldn&apos;t load your account.</h1><button className="primary-button" onClick={() => void refreshAccount()}>Try again</button></section></main>;

  return <div className="account-shell"><main className="account-page">
    <header className="account-hero"><Link href="/discover" className="rail-brand"><span className="brand-mark"><Sparkles size={18} /></span><span>MealSwipe</span></Link><button type="button" onClick={() => void signOut({ redirectTo: "/auth/signin" })}><LogOut size={15} /> Sign out</button></header>
    <section className="account-welcome"><div className="account-avatar">{image ? <Image src={image} alt="" fill sizes="68px" unoptimized /> : account.user.name.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">Your profile</p><h1>{account.user.name}</h1><p>@{account.user.username}</p></div></section>
    {message ? <div className="account-message" role="status"><Check size={15} /> {message}</div> : null}

    {account.receivedInvites.length ? <section className="account-card invitation-notice"><header><div><p className="eyebrow">Notifications</p><h2>{account.receivedInvites.length} household invitation{account.receivedInvites.length === 1 ? "" : "s"}</h2></div><Bell /></header>{account.receivedInvites.map((invite) => <div className="invite-row" key={invite.id}><div><strong>@{invite.invitedBy.username ?? invite.invitedBy.name} invited you to join {invite.householdName}</strong><span>Your profile stays yours. Shared planning begins only if you accept.</span></div><div><button disabled={busy} onClick={() => void mutate(`/api/invitations/${invite.id}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) }, `Joined ${invite.householdName}.`)}>Accept</button><button className="secondary" disabled={busy} onClick={() => void mutate(`/api/invitations/${invite.id}`, { method: "PATCH", body: JSON.stringify({ action: "decline" }) }, "Invitation declined.")}>Decline</button></div></div>)}</section> : null}

    <form className="account-card account-form" onSubmit={saveProfile}><header><div><p className="eyebrow">Personal source of truth</p><h2>Profile & preferences</h2></div><ShieldCheck size={22} /></header>
      <div className="profile-picture-field"><div className="profile-picture-preview">{image ? <Image src={image} alt="Your profile" fill sizes="88px" unoptimized /> : account.user.name.slice(0, 1).toUpperCase()}</div><label className="secondary-button"><ImagePlus size={16} /> Replace picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /></label>{image ? <button className="link-button" type="button" onClick={() => setImage(null)}>Remove</button> : null}</div>
      <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Username<div className="username-input"><span>@</span><input value={username} onChange={(event) => setUsername(event.target.value)} required /></div><small>Your email is never searchable.</small></label>
      <label>Dietary preference<select value={dietary} onChange={(event) => setDietary(event.target.value)}>{["Everything", "Vegetarian", "Vegan", "Pescatarian", "High protein"].map((option) => <option key={option}>{option}</option>)}</select></label>
      <label>Nutrition preference<select value={nutrition} onChange={(event) => setNutrition(event.target.value)}>{nutritionOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
      <fieldset><legend>Allergies · always hard filters</legend><div className="account-checks">{allergyOptions.map((allergy) => <label key={allergy}><input type="checkbox" checked={allergies.includes(allergy)} onChange={() => setAllergies((current) => current.includes(allergy) ? current.filter((item) => item !== allergy) : [...current, allergy])} /> {allergy}</label>)}</div></fieldset>
      <label>Disliked ingredients<input value={dislikes} onChange={(event) => setDislikes(event.target.value)} placeholder="mushrooms, coriander" /></label><label className="onboarding-check"><input type="checkbox" checked={strictDislikes} onChange={(event) => setStrictDislikes(event.target.checked)} /><span>Treat dislikes as strict rules</span></label>
      <div className="account-range-row"><label>Maximum cooking time<input type="number" min="10" max="240" value={maximumCookingTime} onChange={(event) => setMaximumCookingTime(Number(event.target.value))} /></label><label>Personal dinners per week<input type="number" min="1" max="7" value={personalDinnersPerWeek} onChange={(event) => setPersonalDinnersPerWeek(Number(event.target.value))} /></label></div>
      <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
    </form>

    <Link className="account-card household-entry" href="/household"><span className="account-entry-icon"><Users /></span><div><p className="eyebrow">Optional collaboration</p><h2>Household</h2><p>{account.household ? `${account.household.name} · ${account.household.members.length} members` : "Create a household or review invitations when you want to plan together."}</p></div><ChevronRight /></Link>
  </main><BottomNav /></div>;
}
