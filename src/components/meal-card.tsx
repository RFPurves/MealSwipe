"use client";

import Image from "next/image";
import { Clock3, Flame, Play, UtensilsCrossed } from "lucide-react";
import type { Meal } from "@/types";

interface MealCardProps {
  meal: Meal;
  style?: React.CSSProperties;
  className?: string;
  dragAmount?: number;
  interactive?: boolean;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
  onPointerCancel?: React.PointerEventHandler<HTMLDivElement>;
}

export function MealCard({
  meal,
  style,
  className = "",
  dragAmount = 0,
  interactive = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: MealCardProps) {
  return (
    <article
      className={`meal-card ${interactive ? "meal-card-interactive" : ""} ${className}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <Image
        src={meal.image}
        alt={meal.title}
        fill
        priority={interactive}
        sizes="(max-width: 760px) 100vw, 480px"
        className="meal-image"
      />
      <div className="meal-gradient" />
      <div className="video-pill"><Play size={12} fill="currentColor" /> Watch recipe</div>
      {dragAmount > 20 ? <div className="swipe-stamp like-stamp">SAVE</div> : null}
      {dragAmount < -20 ? <div className="swipe-stamp skip-stamp">SKIP</div> : null}
      <div className="meal-card-content">
        <span className="category-pill">{meal.category}</span>
        <h2>{meal.title}</h2>
        <p>{meal.description}</p>
        <div className="meal-meta">
          <span><Clock3 size={15} /> {meal.timeMinutes} min</span>
          <span><Flame size={15} /> {meal.calories} kcal</span>
          <span><UtensilsCrossed size={15} /> {meal.proteinGrams}g protein</span>
        </div>
      </div>
    </article>
  );
}
