"use client";

import { useState } from "react";
import { CheckCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import type { StoryStatus } from "@/types";

interface ApprovalToolbarProps {
  storyId: string;
  currentStatus: StoryStatus;
  onStatusChange?: (newStatus: StoryStatus) => void;
}

const statusConfig: Record<
  string,
  { label: string; nextStatus: StoryStatus; icon: React.ElementType; variant: "default" | "outline" | "destructive" | "secondary" }
> = {
  approve: {
    label: "Approve",
    nextStatus: "approved",
    icon: CheckCircle,
    variant: "default",
  },
  request_changes: {
    label: "Request Changes",
    nextStatus: "needs_changes",
    icon: RefreshCw,
    variant: "outline",
  },
};

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

export function ApprovalToolbar({ storyId, currentStatus, onStatusChange }: ApprovalToolbarProps) {
  const [status, setStatus] = useState<StoryStatus>(currentStatus);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: keyof typeof statusConfig) {
    const { nextStatus } = statusConfig[action];
    setLoading(action);
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("user_stories")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", storyId);

    setLoading(null);

    if (updateError) {
      setError("Failed to update status. Please try again.");
      return;
    }

    setStatus(nextStatus);
    onStatusChange?.(nextStatus);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Current status pill */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status:</span>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[status]}`}
        >
          {statusLabel[status]}
        </span>
      </div>

      {error && (
        <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={statusConfig.approve.variant}
          onClick={() => handleAction("approve")}
          disabled={!!loading || status === "approved" || status === "exported"}
          className="gap-1.5"
        >
          {loading === "approve" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5" />
          )}
          Approve
        </Button>

        <Button
          size="sm"
          variant={statusConfig.request_changes.variant}
          onClick={() => handleAction("request_changes")}
          disabled={!!loading || status === "needs_changes"}
          className="gap-1.5"
        >
          {loading === "request_changes" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Request Changes
        </Button>
      </div>
    </div>
  );
}
