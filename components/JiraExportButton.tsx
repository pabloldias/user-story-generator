"use client";

import { useState } from "react";
import { ExternalLink, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JiraExportRequest, JiraExportResponse } from "@/types";

interface JiraExportButtonProps {
  storyId: string;
  existingKey?: string | null;
  onExported?: (key: string) => void;
}

export function JiraExportButton({ storyId, existingKey, onExported }: JiraExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [result, setResult] = useState<JiraExportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const issueKey = result?.jira_issue_key ?? existingKey;

  async function handleExport() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: JiraExportRequest = { story_id: storyId, dry_run: dryRun };
      const res = await fetch("/api/jira/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as JiraExportResponse;
      setResult(data);
      if (data.jira_issue_key && !dryRun) {
        onExported?.(data.jira_issue_key);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Already exported */}
      {issueKey && !result?.dry_run && (
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
          >
            Exported
          </Badge>
          <a
            href={`#jira-${issueKey}`}
            className="text-sm font-medium text-brand-squid-ink underline underline-offset-4 hover:text-brand-neon-mint transition-colors inline-flex items-center gap-1"
            target="_blank"
            rel="noopener noreferrer"
          >
            {issueKey}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Dry-run result */}
      {result?.dry_run && (
        <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
          Dry-run payload preview generated (no Jira issue created).
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      )}

      {/* Warning from API */}
      {result?.warning && (
        <p className="text-xs text-amber-700 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          {result.warning}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={dryRun ? "outline" : "default"}
          onClick={handleExport}
          disabled={loading}
          className="gap-1.5"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {dryRun ? "Dry Run" : "Export to Jira"}
        </Button>

        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-input"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry run
        </label>
      </div>
    </div>
  );
}
