import { AppShell } from "@/components/app-shell";
import { SavedMeals } from "@/components/saved-meals";

export default function SavedPage() {
  return (
    <AppShell eyebrow="Your shortlist" title="Saved meals">
      <SavedMeals />
    </AppShell>
  );
}
