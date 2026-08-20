"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { ArrowLeft, Mail, ShieldCheck, Sparkles } from "lucide-react";

export function SignInCard({ google, email, microsoft, dev }: { google: boolean; email: boolean; microsoft: boolean; dev: boolean }) {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const emailSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!address.trim()) return;
    setPending("email");
    await signIn("resend", { email: address.trim(), redirectTo: "/account" });
    setPending(null);
  };

  const devSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!address.trim() || !name.trim()) return;
    setPending("dev");
    await signIn("dev-login", { email: address.trim(), name: name.trim(), redirectTo: "/account" });
    setPending(null);
  };

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="auth-back" href="/"><ArrowLeft size={15} /> Back to MealSwipe</Link>
        <div className="auth-mark"><Sparkles size={25} /></div>
        <p className="eyebrow">Your meals, shared safely</p>
        <h1>Sign in to your household</h1>
        <p className="auth-copy">Keep your likes private to you, combine household preferences, and plan a week everyone can eat.</p>
        <div className="auth-actions">
          {google ? <button type="button" onClick={() => { setPending("google"); void signIn("google", { redirectTo: "/account" }); }} disabled={Boolean(pending)}>Continue with Google</button> : null}
          {microsoft ? <button type="button" onClick={() => { setPending("microsoft"); void signIn("microsoft-entra-id", { redirectTo: "/account" }); }} disabled={Boolean(pending)}>Continue with Microsoft</button> : null}
          {email ? <form onSubmit={emailSignIn}><label>Email address<input type="email" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="you@example.com" /></label><button type="submit" disabled={Boolean(pending)}><Mail size={16} /> Email me a sign-in link</button></form> : null}
          {dev ? <form onSubmit={devSignIn} className="dev-login"><strong>Local test account</strong><label>Name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Rab" /></label><label>Email<input type="email" required value={address} onChange={(event) => setAddress(event.target.value)} placeholder="rab@local.test" /></label><button type="submit" disabled={Boolean(pending)}>Continue locally</button></form> : null}
          {!google && !email && !microsoft && !dev ? <div className="auth-unconfigured"><strong>Sign-in is not configured yet.</strong><p>Add an authentication provider in the server environment, then reload this page.</p></div> : null}
        </div>
        <p className="auth-safety"><ShieldCheck size={14} /> API keys and sign-in secrets stay server-side.</p>
      </section>
    </main>
  );
}
