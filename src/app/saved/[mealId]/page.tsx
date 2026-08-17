import { AppShell } from "@/components/app-shell";
import { RecipeDetail } from "@/components/recipe-detail";

export default async function SavedRecipePage({ params }: { params: Promise<{ mealId: string }> }) {
  const { mealId } = await params;
  return (
    <AppShell eyebrow="Saved recipe" title="Cook this one">
      <RecipeDetail mealId={decodeURIComponent(mealId)} />
    </AppShell>
  );
}
