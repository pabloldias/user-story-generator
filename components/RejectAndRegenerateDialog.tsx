"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface RejectAndRegenerateDialogProps {
  requirementId: string;
  rawInput: string;
}

export function RejectAndRegenerateDialog({
  requirementId,
  rawInput,
}: RejectAndRegenerateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFeedback("");
      setError(null);
    }
    setOpen(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: requirementId, feedback }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "Regeneration failed.");
      }

      setOpen(false);
      setFeedback("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="destructive"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
      >
        <XCircle className="h-3.5 w-3.5" />
        Reject &amp; Regenerate
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
              <DialogTitle className="text-destructive">Reject &amp; Regenerate</DialogTitle>
            </div>
            <DialogDescription>
              Describe what context is missing or what was wrong with the generated output. The
              pipeline will re-run using your feedback alongside the original input.
            </DialogDescription>
          </DialogHeader>

          {/* Original input preview */}
          <div className="rounded-md border border-border bg-muted/40 p-3 max-h-36 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-1">Original input</p>
            <p className="text-xs leading-relaxed text-foreground/70 whitespace-pre-wrap">
              {rawInput}
            </p>
          </div>

          {/* Feedback form */}
          <form id="regenerate-form" onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="feedback" className="text-sm font-medium">
                Your feedback <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="feedback"
                placeholder="e.g. The generated story missed the fact that this feature is only for admin users and must support bulk operations…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                className="text-sm resize-none"
                disabled={loading}
                required
                minLength={10}
              />
              <p className="text-xs text-muted-foreground text-right">{feedback.length} / 5000</p>
            </div>

            {error && (
              <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                {error}
              </p>
            )}
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="regenerate-form"
              variant="destructive"
              size="sm"
              disabled={loading || feedback.trim().length < 10}
              className="gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Regenerating…
                </>
              ) : (
                <>
                  <XCircle className="h-3.5 w-3.5" />
                  Reject &amp; Regenerate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
