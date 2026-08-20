"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { ArrowLeft, CalendarDays, ChevronRight, LoaderCircle, Search, Sparkles, UserPlus, Users } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { useMealApp } from "@/components/app-provider";
import type { AccountUser } from "@/types/account";

export function HouseholdDashboard() {
  const { status } = useSession();
  const { account, accountLoading, accountError, refreshAccount } = useMealApp();
  const [householdName, setHouseholdName] = useState(""); const [query, setQuery] = useState("");
  const [results, setResults] = useState<(AccountUser & { available: boolean })[]>([]); const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const mutate = async (url: string, init: RequestInit, success: string) => {
    setBusy(true); setMessage(null);
    try { const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } }); const data = await response.json() as { message?: string }; if (!response.ok) throw new Error(data.message ?? "That could not be completed."); setMessage(success); await refreshAccount(); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "That could not be completed."); return false; }
    finally { setBusy(false); }
  };
  const createHousehold = async (event: FormEvent) => { event.preventDefault(); if (await mutate("/api/households", { method: "POST", body: JSON.stringify({ name: householdName }) }, "Household created.")) setHouseholdName(""); };
  const search = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage(null);
    try { const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`); const data = await response.json() as { users?: (AccountUser & { available: boolean })[]; message?: string }; if (!response.ok) throw new Error(data.message); setResults(data.users ?? []); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Search failed."); } finally { setBusy(false); }
  };
  const invite = async (result: AccountUser & { available: boolean }) => {
    if (await mutate("/api/households/invites", { method: "POST", body: JSON.stringify({ username: result.username }) }, `Invitation sent to @${result.username}.`)) {
      setResults((current) => current.map((user) => user.id === result.id ? { ...user, available: false } : user));
    }
  };

  if (status === "loading" || accountLoading || (status === "authenticated" && !account && !accountError)) return <main className="loading-screen"><LoaderCircle className="spin" /><p>Loading household…</p></main>;
  if (status !== "authenticated") return <main className="auth-page"><section className="auth-card"><div className="auth-mark"><Sparkles /></div><h1>Sign in to open Household.</h1><p className="auth-copy">Your personal MealSwipe stays private until you create or accept a household.</p><Link className="primary-button" href="/auth/signin">Sign in</Link></section></main>;
  if (!account) return <main className="auth-page"><section className="auth-card"><h1>We couldn&apos;t load your household.</h1><p className="auth-copy">Your account is still safe. Try loading it again.</p><button className="primary-button" onClick={() => void refreshAccount()}>Try again</button></section></main>;
  return <div className="account-shell"><main className="account-page">
    <header className="account-hero"><Link href="/account" className="auth-back"><ArrowLeft size={15} /> Profile</Link><Link href="/discover" className="rail-brand"><span className="brand-mark"><Sparkles size={18} /></span><span>MealSwipe</span></Link></header>
    <section className="account-welcome"><div className="account-avatar"><Users /></div><div><p className="eyebrow">Optional collaboration</p><h1>Household</h1><p>Combine accepted members&apos; profiles and eligible likes—without mixing personal plans.</p></div></section>
    {message ? <div className="account-message" role="status">{message}</div> : null}
    {account.receivedInvites.length ? <section className="account-card"><header><div><p className="eyebrow">Pending invitations</p><h2>Choose whether to join</h2></div><UserPlus /></header>{account.receivedInvites.map((invite) => <div className="invite-row" key={invite.id}><div><strong>@{invite.invitedBy.username ?? invite.invitedBy.name} invited you to join {invite.householdName}</strong><span>No membership or profile access is created until you accept.</span></div><div><button disabled={busy} onClick={() => void mutate(`/api/invitations/${invite.id}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) }, `Joined ${invite.householdName}.`)}>Accept</button><button className="secondary" disabled={busy} onClick={() => void mutate(`/api/invitations/${invite.id}`, { method: "PATCH", body: JSON.stringify({ action: "decline" }) }, "Invitation declined.")}>Decline</button></div></div>)}</section> : null}
    {account.household ? <>
      <section className="account-card household-card"><header><div><p className="eyebrow">{account.householdRole === "OWNER" ? "You own this household" : "Accepted membership"}</p><h2>{account.household.name}</h2></div><span>{account.householdRole === "OWNER" ? "Owner" : "Member"}</span></header><div className="member-list">{account.household.members.map((member) => <Link href={member.username ? `/profile/${member.username}` : "/household"} key={member.id}><span className="member-avatar">{member.name.slice(0, 1)}</span><div><strong>{member.name}</strong><small>{member.username ? `@${member.username}` : "Username not set"} · {member.dietary}</small></div><ChevronRight size={16} /></Link>)}</div>{account.pendingInvites.length ? <div className="pending-list"><strong>Invitations awaiting a response</strong>{account.pendingInvites.map((invite) => <span key={invite.id}>@{invite.invitedUser?.username ?? invite.invitedUser?.name}</span>)}</div> : null}</section>
      <Link className="account-card household-entry" href="/household/week"><span className="account-entry-icon"><CalendarDays /></span><div><p className="eyebrow">Separate shared space</p><h2>Shared Week & Pantry</h2><p>Uses live restrictions and eligible likes from accepted members.</p></div><ChevronRight /></Link>
      {account.householdRole === "OWNER" ? <form className="account-card invite-search" onSubmit={search}><header><div><p className="eyebrow">Invite by username</p><h2>Add a member</h2></div><UserPlus /></header><label>Search users<div><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="@sonia" /><button disabled={busy}>Search</button></div></label>{results.length ? <div className="search-results">{results.map((result) => <div key={result.id}>{result.image ? <Image src={result.image} alt="" width={36} height={36} unoptimized /> : <span className="member-avatar">{result.name.slice(0, 1)}</span>}<span><strong>{result.name}</strong><small>@{result.username}</small></span><button type="button" disabled={!result.available || busy} onClick={() => void invite(result)}>{result.available ? "Invite to household" : "Unavailable"}</button></div>)}</div> : null}</form> : null}
    </> : <form className="account-card create-household" onSubmit={createHousehold}><header><div><p className="eyebrow">Optional shared planning</p><h2>Create a household</h2></div><Users /></header><p>Invite people by username. Their profile restrictions and eligible likes join shared planning only after they accept.</p><label>Household name<input value={householdName} onChange={(event) => setHouseholdName(event.target.value)} placeholder="The Purves Household" required /></label><button className="primary-button" disabled={busy}>Create household</button></form>}
  </main><BottomNav /></div>;
}
