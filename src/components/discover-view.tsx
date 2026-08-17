"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Heart, RotateCcw, Sparkles } from "lucide-react";
import { useMealApp } from "@/components/app-provider";
import { MealCard } from "@/components/meal-card";
import { meals } from "@/data/meals";
import { mealIsDiscoverable } from "@/lib/meal-safety";

type Decision = "like" | "skip";

export function DiscoverView() {
  const { preferences, savedIds, skippedIds, likeMeal, skipMeal, resetDiscovery } =
    useMealApp();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetRef = useRef(offset);

  const filteredMeals = useMemo(
    () => meals.filter((meal) => mealIsDiscoverable(meal, preferences)),
    [preferences],
  );
  const remainingMeals = useMemo(() => {
    const seen = new Set([...savedIds, ...skippedIds]);
    return filteredMeals.filter((meal) => !seen.has(meal.id));
  }, [filteredMeals, savedIds, skippedIds]);

  const currentMeal = remainingMeals[0];
  const nextMeal = remainingMeals[1];
  const viewedCount = filteredMeals.length - remainingMeals.length;

  const choose = useCallback(
    (choice: Decision) => {
      if (!currentMeal || decision) return;
      const direction = choice === "like" ? 1 : -1;
      setDecision(choice);
      setDragging(false);
      setOffset({ x: direction * Math.max(window.innerWidth, 620), y: 30 });
      window.setTimeout(() => {
        if (choice === "like") likeMeal(currentMeal.id);
        else skipMeal(currentMeal.id);
        setOffset({ x: 0, y: 0 });
        offsetRef.current = { x: 0, y: 0 };
        setDecision(null);
      }, 260);
    },
    [currentMeal, decision, likeMeal, skipMeal],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") choose("skip");
      if (event.key === "ArrowRight") choose("like");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [choose]);

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (decision) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!dragging || decision) return;
    const nextOffset = {
      x: event.clientX - dragStart.current.x,
      y: (event.clientY - dragStart.current.y) * 0.3,
    };
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const handlePointerUp: React.PointerEventHandler<HTMLDivElement> = () => {
    setDragging(false);
    if (offsetRef.current.x > 105) choose("like");
    else if (offsetRef.current.x < -105) choose("skip");
    else {
      setOffset({ x: 0, y: 0 });
      offsetRef.current = { x: 0, y: 0 };
    }
  };

  if (filteredMeals.length === 0) {
    return (
      <section className="deck-empty">
        <div className="empty-illustration"><Sparkles size={34} /></div>
        <h2>No matches yet</h2>
        <p>Your filters are a little too specific for our starter menu.</p>
        <Link className="primary-button" href="/">Adjust preferences</Link>
      </section>
    );
  }

  if (!currentMeal) {
    return (
      <section className="deck-empty deck-complete">
        <div className="completion-stack" aria-hidden="true">
          {savedIds.slice(-3).map((id, index) => {
            const meal = meals.find((item) => item.id === id);
            return meal ? (
              <div key={id} style={{ transform: `rotate(${(index - 1) * 8}deg)` }}>
                <Image src={meal.image} alt="" fill sizes="130px" />
              </div>
            ) : null;
          })}
          <span><Heart size={30} fill="currentColor" /></span>
        </div>
        <p className="eyebrow">That&apos;s the menu</p>
        <h2>Great taste.</h2>
        <p>You saved {savedIds.length} meal{savedIds.length === 1 ? "" : "s"}. Your week is ready for the next step.</p>
        <div className="empty-actions">
          <Link className="primary-button" href="/saved">See saved meals</Link>
          <button className="secondary-button" type="button" onClick={resetDiscovery}>
            <RotateCcw size={17} /> Start over
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="discover-view">
      <div className="deck-progress" aria-label={`${viewedCount} of ${filteredMeals.length} viewed`}>
        <span style={{ width: `${(viewedCount / filteredMeals.length) * 100}%` }} />
      </div>
      <div className="card-deck">
        {nextMeal ? (
          <MealCard meal={nextMeal} className="meal-card-next" />
        ) : (
          <div className="meal-card meal-card-next deck-last-card" />
        )}
        <MealCard
          meal={currentMeal}
          interactive
          dragAmount={offset.x}
          className={`${dragging ? "is-dragging" : ""}${decision ? " is-exiting" : ""}`}
          style={{
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${offset.x / 22}deg)`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div className="swipe-actions">
        <button
          className="swipe-button skip-button"
          type="button"
          onClick={() => choose("skip")}
          aria-label="Skip meal"
          disabled={Boolean(decision)}
        >
          <ArrowLeft size={25} />
          <span>Skip</span>
        </button>
        <p>Swipe or tap</p>
        <button
          className="swipe-button like-button"
          type="button"
          onClick={() => choose("like")}
          aria-label="Save meal"
          disabled={Boolean(decision)}
        >
          <Heart size={24} fill="currentColor" />
          <span>Like</span>
        </button>
      </div>
    </section>
  );
}
