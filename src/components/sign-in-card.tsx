"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowLeft, Mail, ShieldCheck, Sparkles } from "lucide-react";

export function SignInCard({ google, email, microsoft, dev }: { google: boolean; email: boolean; microsoft: boolean; dev: boolean }) {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const providerSignIn = async (provider: "google" | "microsoft-entra-id") => {
    setPending(provider);
    setError(null);
    try {
      await signIn(provider, { redirectTo: "/" });
    } catch {
      setError("Sign-in could not start. Check your connection and try again.");
    } finally {
      setPending(null);
    }
  };

  const emailSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!address.trim()) return;
    setPending("email"); setError(null);
    try { await signIn("resend", { email: address.trim(), redirectTo: "/" }); }
    catch { setError("Sign-in could not start. Check your connection and try again."); }
    finally { setPending(null); }
  };

  const devSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!address.trim() || !name.trim()) return;
    setPending("dev"); setError(null);
    try { await signIn("dev-login", { email: address.trim(), name: name.trim(), redirectTo: "/" }); }
    catch { setError("Sign-in could not start. Check your connection and try again."); }
    finally { setPending(null); }
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-back" href="/auth/signin"><ArrowLeft size={15} /> MealSwipe</Link>
        <div className="auth-mark"><Sparkles size={25} /></div>
        <p className="eyebrow">Swipe inspiration. Plan dinner.</p>
        <h1>Your next week of meals starts here.</h1>
        <p className="auth-copy">Sign in to save what looks good, build your personal week, and turn it into one smart shopping list.</p>
        <div className="auth-actions">
          {google ? <button type="button" onClick={() => void providerSignIn("google")} disabled={Boolean(pending)}>Continue with Google</button> : null}
          {microsoft ? <button type="button" onClick={() => void providerSignIn("microsoft-entra-id")} disabled={Boolean(pending)}>Continue with Microsoft</button> : null}
          {email ? <form onSubmit={emailSignIn}><label>Email address<input type="email" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="you@example.com" /></label><button type="submit" disabled={Boolean(pending)}><Mail size={16} /> Email me a sign-in link</button></form> : null}
          {dev ? <form onSubmit={devSignIn} className="dev-login"><strong>Local test account</strong><label>Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Rab" /></label><label>Email<input type="email" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="rab@local.test" /></label><button type="submit" disabled={Boolean(pending)}>Continue locally</button></form> : null}
          {!google && !email && !microsoft && !dev ? <div className="auth-unconfigured"><strong>Sign-in is not configured yet.</strong><p>Add an authentication provider in the server environment, then reload this page.</p></div> : null}
        </div>
        {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
        <p className="auth-safety"><ShieldCheck size={14} /> API keys and sign-in secrets stay server-side.</p>
      </section>
    </main>
  );
}
