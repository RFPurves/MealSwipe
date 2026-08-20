"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { Check, ChevronRight, LoaderCircle, LogOut, Search, ShieldCheck, Sparkles, UserPlus, Users } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { useMealApp } from "@/components/app-provider";
import type { AccountUser } from "@/types/account";

const allergyOptions = ["Dairy", "Eggs", "Gluten", "Nuts", "Shellfish", "Soy"];

export function AccountDashboard() {
  const { status } = useSession();
  const app = useMealApp();
  const { account, accountLoading, accountError, refreshAccount } = app;
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [dietary, setDietary] = useState("Everything");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<(AccountUser & { available: boolean })[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!account) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setUsername(account.user.username ?? "");
      setName(account.user.name);
      setDietary(account.preferences.dietary);
      setAllergies(account.preferences.allergies);
      setDislikes(account.preferences.dislikedIngredients.join(", "));
    });
    return () => { active = false; };
  }, [account]);

  useEffect(() => {
    if (status !== "authenticated" || account || accountLoading || accountError) return;
    queueMicrotask(() => void refreshAccount());
  }, [account, accountError, accountLoading, refreshAccount, status]);

  const mutate = async (url: string, init: RequestInit, success: string) => {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = await response.json() as { message?: string };
      if (!response.ok) throw new Error(data.message ?? "That could not be completed.");
      setMessage(success);
      await refreshAccount();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "That could not be completed.");
      return false;
    } finally { setBusy(false); }
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    await mutate("/api/account/profile", { method: "PATCH", body: JSON.stringify({ username, name, preferences: { dietary, allergies, dislikedIngredients: dislikes.split(",").map((item) => item.trim()).filter(Boolean), categories: account?.preferences.categories ?? [] } }) }, "Profile and food preferences saved.");
  };

  const createHousehold = async (event: FormEvent) => {
    event.preventDefault();
    if (await mutate("/api/households", { method: "POST", body: JSON.stringify({ name: householdName }) }, "Household created.")) setHouseholdName("");
  };

  const search = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
      const data = await response.json() as { users?: (AccountUser & { available: boolean })[]; message?: string };
      if (!response.ok) throw new Error(data.message);
      setResults(data.users ?? []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Search failed."); }
    finally { setBusy(false); }
  };

  if (status === "loading" || (status === "authenticated" && !account && !accountError)) return <main className="loading-screen"><LoaderCircle className="spin" /><p>Loading your household…</p></main>;
  if (status !== "authenticated") return <main className="auth-page"><section className="auth-card"><div className="auth-mark"><Sparkles /></div><h1>Make MealSwipe yours</h1><p className="auth-copy">Sign in to create a household, invite another member, and sync your meal plan.</p><Link className="primary-button" href="/auth/signin">Sign in</Link></section></main>;
  if (!account) return <main className="auth-page"><section className="auth-card"><h1>We couldn&apos;t load your account.</h1><p className="auth-copy">Check the database connection and try again.</p><button className="primary-button" onClick={() => void refreshAccount()}>Try again</button></section></main>;

  return (
    <div className="account-shell">
      <main className="account-page">
        <header className="account-hero"><Link href="/discover" className="rail-brand"><span className="brand-mark"><Sparkles size={18} /></span><span>MealSwipe</span></Link><button type="button" onClick={() => void signOut({ redirectTo: "/" })}><LogOut size={15} /> Sign out</button></header>
        <section className="account-welcome"><div className="account-avatar">{account.user.name.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">Your account</p><h1>{account.user.name}</h1><p>{account.user.username ? `@${account.user.username}` : "Choose your unique MealSwipe username"}</p></div></section>
        {message ? <div className="account-message" role="status"><Check size={15} /> {message}</div> : null}

        <form className="account-card account-form" onSubmit={saveProfile}>
          <header><div><p className="eyebrow">Profile & safety</p><h2>Your preferences</h2></div><ShieldCheck size={22} /></header>
          <label>Display name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Username<div className="username-input"><span>@</span><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="rab" required /></div><small>3–24 letters, numbers, dots, or underscores. Your email is never searchable.</small></label>
          <label>Dietary preference<select value={dietary} onChange={(event) => setDietary(event.target.value)}><option>Everything</option><option>Vegetarian</option><option>Vegan</option><option>Pescatarian</option><option>High protein</option></select></label>
          <fieldset><legend>Allergies (always treated as hard filters)</legend><div className="account-checks">{allergyOptions.map((allergy) => <label key={allergy}><input type="checkbox" checked={allergies.includes(allergy)} onChange={() => setAllergies((current) => current.includes(allergy) ? current.filter((item) => item !== allergy) : [...current, allergy])} /> {allergy}</label>)}</div></fieldset>
          <label>Disliked ingredients<input value={dislikes} onChange={(event) => setDislikes(event.target.value)} placeholder="mushrooms, coriander" /><small>Separate ingredients with commas.</small></label>
          <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save profile"}</button>
        </form>

        {account.receivedInvites.length ? <section className="account-card"><header><div><p className="eyebrow">Invitations</p><h2>Join a household</h2></div><UserPlus /></header>{account.receivedInvites.map((invite) => <div className="invite-row" key={invite.id}><div><strong>{invite.householdName}</strong><span>Invited by @{invite.invitedBy.username ?? invite.invitedBy.name}</span></div><div><button onClick={() => void mutate(`/api/invitations/${invite.id}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) }, `Joined ${invite.householdName}.`)}>Accept</button><button className="secondary" onClick={() => void mutate(`/api/invitations/${invite.id}`, { method: "PATCH", body: JSON.stringify({ action: "decline" }) }, "Invitation declined.")}>Decline</button></div></div>)}</section> : null}

        {account.household ? <section className="account-card household-card"><header><div><p className="eyebrow">Shared household</p><h2>{account.household.name}</h2></div><span>{account.householdRole === "OWNER" ? "Owner" : "Member"}</span></header><div className="member-list">{account.household.members.map((member) => <Link href={member.username ? `/profile/${member.username}` : "/account"} key={member.id}><span className="member-avatar">{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><small>{member.username ? `@${member.username}` : "Username not set"} · {member.dietary}</small></div><ChevronRight size={16} /></Link>)}</div>{account.pendingInvites.length ? <div className="pending-list"><strong>Pending</strong>{account.pendingInvites.map((invite) => <span key={invite.id}>@{invite.invitedUser?.username ?? invite.invitedUser?.name}</span>)}</div> : null}{account.householdRole === "OWNER" ? <form className="invite-search" onSubmit={search}><label>Invite by username<div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search @username" /><button disabled={busy}>Search</button></div></label>{results.length ? <div className="search-results">{results.map((result) => <div key={result.id}><span><strong>{result.name}</strong><small>@{result.username}</small></span><button type="button" disabled={!result.available || busy} onClick={() => void mutate("/api/households/invites", { method: "POST", body: JSON.stringify({ username: result.username }) }, `Invitation sent to @${result.username}.`)}>{result.available ? "Invite" : "In a household"}</button></div>)}</div> : null}</form> : null}</section> : <form className="account-card create-household" onSubmit={createHousehold}><header><div><p className="eyebrow">Shared planning</p><h2>Create your household</h2></div><Users /></header><p>Start a household, then invite another MealSwipe user by their username.</p><label>Household name<input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="The Purves household" required /></label><button className="primary-button" disabled={busy}>Create household</button></form>}
      </main>
      <BottomNav />
    </div>
  );
}
