import { AppShell } from "@/components/app-shell";
import { WeekPlanner } from "@/components/week-planner";

export default function HouseholdWeekPage() {
  return <AppShell eyebrow="Household plan" title="Shared week"><WeekPlanner scope="household" /></AppShell>;
}
