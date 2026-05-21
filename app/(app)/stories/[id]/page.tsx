import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetadataBadges } from "@/components/MetadataBadges";
import { ConfidenceIndicator } from "@/components/ConfidenceIndicator";
import { ApprovalToolbar } from "@/components/ApprovalToolbar";
import { RejectAndRegenerateDialog } from "@/components/RejectAndRegenerateDialog";
import { JiraExportButton } from "@/components/JiraExportButton";
import { ExportButton } from "@/components/ExportButton";
import { StoryEditor } from "@/components/StoryEditor";
import { getFlagLabel } from "@/lib/flags";
import type { UserStory, Requirement } from "@/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StoryDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: story } = await supabase
    .from("user_stories")
    .select("*")
    .eq("id", id)
    .single();

  if (!story) notFound();

  const s = story as UserStory;

  const { data: requirement } = await supabase
    .from("requirements")
    .select("id, raw_input")
    .eq("id", s.requirement_id)
    .single();

  const req = requirement as Pick<Requirement, "id" | "raw_input"> | null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Link href={`/requirements/${s.requirement_id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{s.title}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Created {new Date(s.created_at).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="pt-4 flex flex-col gap-3">
          <MetadataBadges
            priority={s.priority}
            storyPoints={s.story_points}
            labels={s.labels}
            confidenceScore={s.confidence_score}
          />
          <ConfidenceIndicator score={s.confidence_score} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Editor — takes 2/3 */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Edit Story</CardTitle>
            </CardHeader>
            <CardContent>
              <StoryEditor story={s} />
            </CardContent>
          </Card>
        </div>

        {/* Right panel — Approval + Jira */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Approval</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <ApprovalToolbar storyId={s.id} currentStatus={s.status} />
              {req && (
                <RejectAndRegenerateDialog
                  requirementId={req.id}
                  rawInput={req.raw_input}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Jira Export</CardTitle>
            </CardHeader>
            <CardContent>
              <JiraExportButton storyId={s.id} existingKey={s.jira_issue_key} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Download</CardTitle>
            </CardHeader>
            <CardContent>
              <ExportButton stories={[s]} label={s.title} />
            </CardContent>
          </Card>

          {/* Flags */}
          {s.flags && s.flags.length > 0 && (
            <Card className="border-amber-200 bg-amber-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-amber-700">Flags &amp; Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {s.flags.map((flag, i) => {
                    const { title, description } = getFlagLabel(flag);
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-semibold text-amber-800">{title}</span>
                          <span className="text-xs text-amber-700 leading-relaxed">
                            {description}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
