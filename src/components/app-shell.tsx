"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { RotateCcw, Sparkles, UserRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useMealApp } from "@/components/app-provider";
import { BottomNav } from "@/components/bottom-nav";

interface AppShellProps {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}

export function AppShell({ children, eyebrow, title, action }: AppShellProps) {
  const router = useRouter();
  const { status } = useSession();
  const { hydrated, hasOnboarded, resetApp, account } = useMealApp();

  useEffect(() => {
    if (hydrated && !hasOnboarded) {
      router.replace("/");
    }
  }, [hasOnboarded, hydrated, router]);

  if (!hydrated || !hasOnboarded) {
    return (
      <main className="loading-screen">
        <div className="brand-mark brand-mark-large">
          <Sparkles size={25} />
        </div>
        <p>Preparing your menu…</p>
      </main>
    );
  }

  const restart = () => {
    resetApp();
    router.push("/");
  };

  return (
    <div className="app-shell">
      <aside className="desktop-rail">
        <Link href="/discover" className="rail-brand" aria-label="Meal Swipe home">
          <span className="brand-mark">
            <Sparkles size={20} />
          </span>
          <span>MealSwipe</span>
        </Link>
        <div className="rail-copy">
          <span className="eyebrow">Inspiration becomes action.</span>
          <h2>The food you want. Your whole week, intelligently planned.</h2>
          <p>
            Discover food visually, turn favourites into personalized recipes,
            and get one week that reuses ingredients on purpose.
          </p>
        </div>
        <button className="text-button" type="button" onClick={restart}>
          <RotateCcw size={15} /> Change preferences
        </button>
      </aside>

      <main className="mobile-app">
        <header className="app-header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
          <div className="header-actions">
            {action}
            <Link className="header-account-control" href={status === "authenticated" ? "/account" : "/auth/signin"} aria-label={status === "authenticated" ? "Open household account" : "Sign in"}>
              <span>{account?.user.name ? account.user.name.slice(0, 1).toUpperCase() : <UserRound size={17} />}</span>
              <b>{status === "authenticated" ? account?.user.username ? `@${account.user.username}` : "Account" : "Sign in"}</b>
            </Link>
          </div>
        </header>
        <div className="app-content">{children}</div>
        <BottomNav />
      </main>
    </div>
  );
}
