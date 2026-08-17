import { AppShell } from "@/components/app-shell";
import { WeekPlanner } from "@/components/week-planner";

export default function WeekPage() {
  return (
    <AppShell eyebrow="Plan smarter" title="My week">
      <WeekPlanner />
    </AppShell>
  );
}
