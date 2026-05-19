import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Card, CardContent } from "@/components/ui/card";
import { StoryCard } from "@/components/StoryCard";
import type { UserStory } from "@/types";

export default async function StoriesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stories } = await supabase
    .from("user_stories")
    .select("*")
    .order("created_at", { ascending: false });

  const storyList = (stories as UserStory[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stories</h1>
        <p className="text-muted-foreground text-sm mt-1">
          All generated user stories across your projects.
        </p>
      </div>

      {storyList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No stories generated yet.</p>
            <Link
              href="/requirements/new"
              className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-brand-neon-mint transition-colors"
            >
              Generate your first stories →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {storyList.map((story) => (
            <StoryCard key={story.id} story={story} linkable />
          ))}
        </div>
      )}
    </div>
  );
}
