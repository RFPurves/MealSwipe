import { AppShell } from "@/components/app-shell";
import { WeekPlanner } from "@/components/week-planner";

export default function WeekPage() {
  return (
    <AppShell eyebrow="Personal plan" title="My week">
      <WeekPlanner scope="personal" />
    </AppShell>
  );
}
