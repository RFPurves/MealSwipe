"use client";

import Link from "next/link";
import { Bookmark, CalendarDays, Flame, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMealApp } from "@/components/app-provider";

const navItems = [
  { href: "/discover", label: "Discover", icon: Flame },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/week", label: "My Week", icon: CalendarDays },
  { href: "/account", label: "Household", icon: Users },
];

export function BottomNav() {
  const pathname = usePathname();
  const { savedIds } = useMealApp();

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href === "/account" && pathname.startsWith("/profile/"));
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${active ? " nav-item-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="nav-icon-wrap">
              <Icon size={22} strokeWidth={active ? 2.7 : 2} />
              {label === "Saved" && savedIds.length > 0 ? (
                <span className="nav-badge">{savedIds.length}</span>
              ) : null}
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
