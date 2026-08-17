"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Heart,
  LoaderCircle,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useMealApp } from "@/components/app-provider";
import { DiscoverView } from "@/components/discover-view";
import type { Meal, YouTubeMealCandidate } from "@/types";

type Decision = "like" | "skip";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function VideoFeed({ videos }: { videos: YouTubeMealCandidate[] }) {
  const {
    preferences,
    savedIds,
    skippedIds,
    saveVideoMeal,
    skipMeal,
    updateVideoRecipe,
    markRecipeFailed,
  } = useMealApp();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const remaining = useMemo(() => {
    const seen = new Set([...savedIds, ...skippedIds]);
    return videos.filter((video) => !seen.has(`youtube:${video.videoId}`));
  }, [savedIds, skippedIds, videos]);
  const current = remaining[0];
  const next = remaining[1];
  const viewedCount = videos.length - remaining.length;

  const sendPlayerCommand = (func: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args: [] }),
      "https://www.youtube-nocookie.com",
    );
  };

  const createRecipe = useCallback(async (candidate: YouTubeMealCandidate, id: string) => {
    try {
      const response = await fetch("/api/recipes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidate, preferences }),
      });
      if (!response.ok) throw new Error(`Recipe request failed with ${response.status}`);
      const result = await response.json() as { meal: Meal };
      updateVideoRecipe(id, result.meal);
    } catch {
      markRecipeFailed(id);
    }
  }, [markRecipeFailed, preferences, updateVideoRecipe]);

  const choose = useCallback((choice: Decision) => {
    if (!current || decision) return;
    const direction = choice === "like" ? 1 : -1;
    setDecision(choice);
    setDragging(false);
    setOffset({ x: direction * Math.max(window.innerWidth, 620), y: 30 });
    if (choice === "like") {
      const id = saveVideoMeal(current);
      setNotice("Saved — creating your recipe…");
      window.setTimeout(() => setNotice(null), 2400);
      void createRecipe(current, id);
    }
    window.setTimeout(() => {
      if (choice === "skip") skipMeal(`youtube:${current.videoId}`);
      setOffset({ x: 0, y: 0 });
      offsetRef.current = { x: 0, y: 0 };
      setDecision(null);
      setMuted(true);
      setPlaying(true);
    }, 260);
  }, [createRecipe, current, decision, saveVideoMeal, skipMeal]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") choose("skip");
      if (event.key === "ArrowRight") choose("like");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      y: (event.clientY - dragStart.current.y) * 0.22,
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

  if (!current) {
    return (
      <section className="deck-empty deck-complete">
        <div className="empty-illustration"><Heart size={34} fill="currentColor" /></div>
        <p className="eyebrow">Feed complete</p>
        <h2>That&apos;s a tasty shortlist.</h2>
        <p>Your video recipes are waiting in Saved, including any recipes still being prepared.</p>
        <div className="empty-actions">
          <Link className="primary-button" href="/saved">See saved meals</Link>
          <button className="secondary-button" type="button" onClick={() => window.location.reload()}>
            <RotateCcw size={17} /> Refresh videos
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="video-discovery">
      <div className="deck-progress" aria-label={`${viewedCount} of ${videos.length} viewed`}>
        <span style={{ width: `${(viewedCount / videos.length) * 100}%` }} />
      </div>
      {notice ? <div className="recipe-toast"><LoaderCircle className="spin" size={16} /> {notice}</div> : null}
      <div className="video-deck">
        {next ? (
          <div className="video-card video-card-next" aria-hidden="true">
            <Image src={next.thumbnail} alt="" fill loading="eager" sizes="520px" />
          </div>
        ) : null}
        <div
          className={`video-card video-card-active${dragging ? " is-dragging" : ""}${decision ? " is-exiting" : ""}`}
          style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${offset.x / 24}deg)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <iframe
            ref={iframeRef}
            key={current.videoId}
            src={`https://www.youtube-nocookie.com/embed/${current.videoId}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&enablejsapi=1`}
            title={`${current.title} by ${current.channelTitle}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
          <div className="video-vignette" />
          <div className="swipe-stamp skip-stamp" style={{ opacity: Math.max(0, -offset.x / 130) }}>SKIP</div>
          <div className="swipe-stamp save-stamp" style={{ opacity: Math.max(0, offset.x / 130) }}>SAVE</div>
          <div className="video-player-controls">
            <button
              type="button"
              aria-label={playing ? "Pause video" : "Play video"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                sendPlayerCommand(playing ? "pauseVideo" : "playVideo");
                setPlaying((value) => !value);
              }}
            >
              {playing ? <span className="pause-icon">Ⅱ</span> : <Play size={17} fill="currentColor" />}
            </button>
            <button
              type="button"
              aria-label={muted ? "Unmute video" : "Mute video"}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                sendPlayerCommand(muted ? "unMute" : "mute");
                setMuted((value) => !value);
              }}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          </div>
          <div className="video-meal-copy">
            <span className="creator-line">@{current.channelTitle}</span>
            <h2>{current.title}</h2>
            <p>{current.description || "Watch the creator make this recipe step by step."}</p>
            <div className="video-meta">
              <span>{current.category}</span>
              <span><Clock3 size={13} /> {formatDuration(current.durationSeconds)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="swipe-actions video-swipe-actions">
        <button className="swipe-button skip-button" type="button" onClick={() => choose("skip")} disabled={Boolean(decision)}>
          <ArrowLeft size={25} /><span>Skip</span>
        </button>
        <p>Swipe or tap</p>
        <button className="swipe-button like-button" type="button" onClick={() => choose("like")} disabled={Boolean(decision)}>
          <Heart size={24} fill="currentColor" /><span>Like</span>
        </button>
      </div>
    </section>
  );
}

export function DiscoverExperience() {
  const { preferences } = useMealApp();
  const [videos, setVideos] = useState<YouTubeMealCandidate[] | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/youtube/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preferences }),
          signal: controller.signal,
        });
        const result = await response.json() as { videos?: YouTubeMealCandidate[]; message?: string };
        if (!response.ok || !result.videos?.length) {
          setFallbackMessage(result.message ?? "No live video matches were found, so the curated demo menu is ready.");
          setVideos([]);
          return;
        }
        setVideos(result.videos);
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setFallbackMessage("Live videos could not load. Your curated demo menu is ready instead.");
        setVideos([]);
      }
    };
    void load();
    return () => controller.abort();
  }, [preferences]);

  if (videos === null) {
    return (
      <section className="video-loading">
        <div className="video-loading-card">
          <div className="video-loading-glow"><Sparkles size={28} /></div>
          <LoaderCircle className="spin" size={22} />
          <h2>Finding your cooking feed</h2>
          <p>Searching for embeddable recipes that match your taste.</p>
        </div>
      </section>
    );
  }

  if (videos.length > 0) return <VideoFeed videos={videos} />;

  return (
    <>
      <div className="fallback-banner">
        <Sparkles size={17} />
        <div><strong>Demo menu active</strong><p>{fallbackMessage}</p></div>
      </div>
      <DiscoverView />
    </>
  );
}
