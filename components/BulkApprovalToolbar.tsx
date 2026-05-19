"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import type { StoryStatus, UserStory } from "@/types";

interface BulkApprovalToolbarProps {
  /** All stories belonging to the current scope (requirement or project) */
  stories: UserStory[];
}

export function BulkApprovalToolbar({ stories }: BulkApprovalToolbarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const approvable = stories.filter(
    (s) => s.status !== "approved" && s.status !== "exported"
  );

  if (approvable.length === 0) return null;

  async function handleBulkApprove() {
    setLoading(true);
    setError(null);
    setDone(false);

    const supabase = createClient();
    const ids = approvable.map((s) => s.id);
    const nextStatus: StoryStatus = "approved";

    const { error: updateError } = await supabase
      .from("user_stories")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .in("id", ids);

    setLoading(false);

    if (updateError) {
      setError("Bulk approval failed. Please try again.");
      return;
    }

    setDone(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}
      {done && (
        <p className="text-xs text-emerald-700 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          {approvable.length} {approvable.length === 1 ? "story" : "stories"} approved.
        </p>
      )}
      <Button
        size="sm"
        variant="default"
        onClick={handleBulkApprove}
        disabled={loading || done}
        className="gap-1.5 w-fit"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle className="h-3.5 w-3.5" />
        )}
        Approve All ({approvable.length})
      </Button>
    </div>
  );
}
