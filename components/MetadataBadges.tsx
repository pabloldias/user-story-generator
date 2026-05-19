import { Badge } from "@/components/ui/badge";
import type { Priority, StoryPoints } from "@/types";

interface MetadataBadgesProps {
  priority: Priority;
  storyPoints: StoryPoints | null;
  labels: string[];
  confidenceScore: number;
}

const priorityVariant: Record<Priority, "default" | "secondary" | "destructive" | "outline"> = {
  Low: "secondary",
  Medium: "outline",
  High: "default",
  Critical: "destructive",
};

const priorityColor: Record<Priority, string> = {
  Low: "bg-slate-100 text-slate-700 border-slate-200",
  Medium: "bg-blue-50 text-blue-700 border-blue-200",
  High: "bg-orange-50 text-orange-700 border-orange-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

export function MetadataBadges({
  priority,
  storyPoints,
  labels,
  confidenceScore,
}: MetadataBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {/* Priority */}
      <Badge
        variant={priorityVariant[priority]}
        className={`text-xs font-medium border ${priorityColor[priority]}`}
      >
        {priority}
      </Badge>

      {/* Story Points */}
      {storyPoints != null && (
        <Badge
          variant="outline"
          className="text-xs font-medium bg-violet-50 text-violet-700 border-violet-200"
        >
          {storyPoints} {storyPoints === 1 ? "pt" : "pts"}
        </Badge>
      )}

      {/* Confidence */}
      <Badge
        variant="outline"
        className={`text-xs font-medium border ${
          confidenceScore < 0.6
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200"
        }`}
      >
        {Math.round(confidenceScore * 100)}% confidence
      </Badge>

      {/* Labels */}
      {labels.map((label) => (
        <Badge
          key={label}
          variant="secondary"
          className="text-xs bg-brand-aqua-breeze/60 text-brand-squid-ink border-0"
        >
          {label}
        </Badge>
      ))}
    </div>
  );
}
