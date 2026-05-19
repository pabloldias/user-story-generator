import { AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfidenceIndicatorProps {
  score: number;
  className?: string;
  showLabel?: boolean;
}

export function ConfidenceIndicator({
  score,
  className,
  showLabel = true,
}: ConfidenceIndicatorProps) {
  const pct = Math.round(score * 100);
  const isFlagged = score < 0.6;

  const barColor = isFlagged
    ? "bg-amber-400"
    : score < 0.8
    ? "bg-blue-400"
    : "bg-emerald-500";

  const textColor = isFlagged ? "text-amber-700" : "text-emerald-700";

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {showLabel && (
        <div className={cn("flex items-center gap-1.5 text-xs font-medium", textColor)}>
          {isFlagged ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            {isFlagged ? "Low confidence — review recommended" : `${pct}% confidence`}
          </span>
        </div>
      )}
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
