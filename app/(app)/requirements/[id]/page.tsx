import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle, MessageSquareWarning } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StoryCard } from "@/components/StoryCard";
import { BulkApprovalToolbar } from "@/components/BulkApprovalToolbar";
import { ExportButton } from "@/components/ExportButton";
import { RejectAndRegenerateDialog } from "@/components/RejectAndRegenerateDialog";
import type { Requirement, UserStory } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function RequirementDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: requirement } = await supabase
    .from("requirements")
    .select("*")
    .eq("id", id)
    .single();

  if (!requirement) notFound();

  const { data: stories } = await supabase
    .from("user_stories")
    .select("*")
    .eq("requirement_id", id)
    .order("created_at", { ascending: true });

  const req = requirement as Requirement;
  const storyList = (stories as UserStory[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Link href={req.project_id ? `/projects/${req.project_id}` : "/dashboard"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Requirement</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Side-by-side view: raw input and generated stories.
          </p>
        </div>
      </div>

      {/* Side-by-side layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left — Raw Input */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Raw Input
            </h2>
            <span
              className={`text-xs rounded-full px-2 py-0.5 font-medium ${
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
          </div>

          <Card className="border-border">
            <CardContent className="pt-4 flex flex-col gap-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
                {req.raw_input}
              </p>
              <p className="text-xs text-muted-foreground">
                Submitted {new Date(req.created_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          {/* Previous rejection feedback (if any) */}
          {req.rejection_feedback && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquareWarning className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <p className="text-xs font-semibold text-amber-700">Previous reviewer feedback</p>
              </div>
              <p className="text-xs leading-relaxed whitespace-pre-wrap text-amber-800">
                {req.rejection_feedback}
              </p>
            </div>
          )}

          {/* Reject & Regenerate — only available when stories have been generated */}
          {req.status === "completed" && storyList.length > 0 && (
            <RejectAndRegenerateDialog
              requirementId={req.id}
              rawInput={req.raw_input}
            />
          )}
        </div>

        {/* Right — Generated Stories */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Generated Stories
            </h2>
            <span className="text-xs text-muted-foreground">
              {storyList.length} {storyList.length === 1 ? "story" : "stories"}
            </span>
          </div>

          {storyList.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              <BulkApprovalToolbar stories={storyList} />
              <ExportButton stories={storyList} label={`requirement-${req.id.slice(0, 8)}`} />
            </div>
          )}

          {req.status === "processing" && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-4">
                <p className="text-sm text-blue-700">
                  Pipeline is still running — refresh in a moment.
                </p>
              </CardContent>
            </Card>
          )}

          {req.status === "failed" && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="flex items-center gap-2 pt-4">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive">
                  The pipeline failed to generate stories for this requirement.
                </p>
              </CardContent>
            </Card>
          )}

          {storyList.length === 0 && req.status === "completed" && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <p className="text-sm text-muted-foreground">No stories were generated.</p>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {storyList.map((story) => (
              <StoryCard key={story.id} story={story} linkable />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
