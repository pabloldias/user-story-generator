import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StoryCard } from "@/components/StoryCard";
import type { Project, Requirement, UserStory } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch project (RLS ensures ownership)
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) notFound();

  // Fetch requirements for this project
  const { data: requirements } = await supabase
    .from("requirements")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Fetch all stories for these requirements
  const reqIds = (requirements ?? []).map((r: Requirement) => r.id);
  const { data: stories } =
    reqIds.length > 0
      ? await supabase
          .from("user_stories")
          .select("*")
          .in("requirement_id", reqIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const storiesByReq = (stories as UserStory[] ?? []).reduce<Record<string, UserStory[]>>(
    (acc, story) => {
      acc[story.requirement_id] = [...(acc[story.requirement_id] ?? []), story];
      return acc;
    },
    {}
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{(project as Project).name}</h1>
            {(project as Project).description && (
              <p className="text-muted-foreground text-sm mt-0.5">{(project as Project).description}</p>
            )}
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={`/requirements/new?project_id=${id}`}>
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Requirement
          </Link>
        </Button>
      </div>

      {/* Requirements + Stories */}
      {!requirements || requirements.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-sm text-muted-foreground">No requirements yet for this project.</p>
            <Button asChild size="sm" variant="outline">
              <Link href={`/requirements/new?project_id=${id}`}>
                Generate your first user stories
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {(requirements as Requirement[]).map((req) => (
            <section key={req.id}>
              <div className="flex items-center justify-between mb-3">
                <Link
                  href={`/requirements/${req.id}`}
                  className="group flex items-center gap-2"
                >
                  <h2 className="text-sm font-semibold line-clamp-1 group-hover:underline underline-offset-4">
                    {req.raw_input.slice(0, 100)}
                    {req.raw_input.length > 100 ? "…" : ""}
                  </h2>
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 font-medium shrink-0 ${
                      req.status === "completed"
                        ? "bg-emerald-50 text-emerald-700"
                        : req.status === "processing"
                        ? "bg-blue-50 text-blue-700"
                        : req.status === "failed"
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {req.status}
                  </span>
                </Link>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(req.created_at).toLocaleDateString()}
                </span>
              </div>

              {storiesByReq[req.id] && storiesByReq[req.id].length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {storiesByReq[req.id].map((story) => (
                    <StoryCard key={story.id} story={story} linkable />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No stories generated yet.</p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
