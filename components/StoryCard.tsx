import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MetadataBadges } from "@/components/MetadataBadges";
import { ConfidenceIndicator } from "@/components/ConfidenceIndicator";
import type { StoryStatus, UserStory } from "@/types";

const statusLabel: Record<StoryStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  needs_changes: "Needs Changes",
  exported: "Exported",
};

const statusColor: Record<StoryStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  under_review: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  needs_changes: "bg-amber-50 text-amber-700",
  exported: "bg-violet-50 text-violet-700",
};

interface StoryCardProps {
  story: UserStory;
  /** If true, wrap the card in a link to /stories/[id] */
  linkable?: boolean;
}

export function StoryCard({ story, linkable = false }: StoryCardProps) {
  const card = (
    <Card className="flex flex-col gap-0 border border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base font-semibold leading-snug line-clamp-2">
            {story.title}
          </CardTitle>
          <span
            className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[story.status]}`}
          >
            {statusLabel[story.status]}
          </span>
        </div>
        <MetadataBadges
          priority={story.priority}
          storyPoints={story.story_points}
          labels={story.labels}
          confidenceScore={story.confidence_score}
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">
          {story.story_body}
        </p>

        {/* Acceptance criteria preview */}
        {story.acceptance_criteria && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
              Acceptance Criteria
            </p>
            <p className="text-xs text-foreground/70 whitespace-pre-wrap line-clamp-4">
              {story.acceptance_criteria}
            </p>
          </div>
        )}

        {/* Confidence bar */}
        <ConfidenceIndicator score={story.confidence_score} />

        {/* Flags/Warnings */}
        {story.flags && story.flags.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="text-xs font-semibold text-amber-700">Flags</span>
            </div>
            <ul className="space-y-0.5">
              {story.flags.map((flag, i) => (
                <li key={i} className="text-xs text-amber-700">
                  • {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {new Date(story.created_at).toLocaleDateString()}
        </span>
        {story.jira_issue_key && (
          <span className="text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded px-2 py-0.5">
            {story.jira_issue_key}
          </span>
        )}
      </CardFooter>
    </Card>
  );

  if (linkable) {
    return (
      <Link href={`/stories/${story.id}`} className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg">
        {card}
      </Link>
    );
  }

  return card;
}
