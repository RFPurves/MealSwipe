import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DiscoverExperience } from "@/components/discover-experience";

export default function DiscoverPage() {
  return (
    <AppShell
      eyebrow="Discover food visually"
      title="What looks good?"
      action={
        <Link className="header-action" href="/" aria-label="Edit meal preferences">
          <SlidersHorizontal size={19} />
        </Link>
      }
    >
      <DiscoverExperience />
    </AppShell>
  );
}
