"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Globe2, Home, LoaderCircle, Lock, Sparkles } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import type { Meal } from "@/types";
import type { RecipeVisibility } from "@/types/account";

interface ProfilePayload {
  profile: { name: string; username: string; image: string | null; sameHousehold: boolean; likedMealsCount: number; householdMember: boolean };
  recipes: { recipe: Meal; visibility: RecipeVisibility }[];
}

export function ProfileView({ username }: { username: string }) {
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void fetch(`/api/profiles/${encodeURIComponent(username)}`).then(async (response) => {
      const payload = await response.json() as ProfilePayload & { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Profile unavailable.");
      if (active) setData(payload);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Profile unavailable."); });
    return () => { active = false; };
  }, [username]);

  if (!data && !error) return <main className="loading-screen"><LoaderCircle className="spin" /><p>Loading profile…</p></main>;
  return <div className="account-shell"><main className="account-page profile-page"><Link className="auth-back" href="/account"><ArrowLeft size={15} /> Household</Link>{error ? <section className="account-card"><h1>{error}</h1></section> : data ? <><section className="profile-hero"><div className="account-avatar">{data.profile.image ? <Image src={data.profile.image} alt="" width={68} height={68} priority /> : data.profile.name.slice(0, 1)}</div><p className="eyebrow">MealSwipe profile</p><h1>{data.profile.name}</h1><p>@{data.profile.username}</p><div className="profile-stats"><strong>{data.profile.likedMealsCount}</strong><span>liked meal{data.profile.likedMealsCount === 1 ? "" : "s"}</span></div>{data.profile.sameHousehold ? <span><Home size={13} /> In your household</span> : data.profile.householdMember ? <span><Lock size={13} /> Household private</span> : null}</section><section className="account-card"><header><div><p className="eyebrow">Visible recipes</p><h2>Shared cooking ideas</h2></div><Sparkles /></header>{data.recipes.length ? <div className="profile-recipes">{data.recipes.map(({ recipe, visibility }, index) => <Link href={`/saved/${encodeURIComponent(recipe.id)}`} key={recipe.id}><Image src={recipe.image} alt="" width={76} height={76} loading={index === 0 ? "eager" : "lazy"} /><div><strong>{recipe.title}</strong><span>{visibility === "PUBLIC" ? <><Globe2 size={12} /> Public</> : visibility === "HOUSEHOLD" ? <><Home size={12} /> Household</> : <><Lock size={12} /> Private</>}</span></div></Link>)}</div> : <p className="account-empty">No recipes are visible to you yet.</p>}</section></> : null}</main><BottomNav /></div>;
}
