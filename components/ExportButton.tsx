"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserStory } from "@/types";

interface ExportButtonProps {
  stories: UserStory[];
  /** Label prefix used in the downloaded filename, e.g. "requirement-abc" */
  label?: string;
}

function storiesToCSV(stories: UserStory[]): string {
  const headers = [
    "id",
    "title",
    "story_body",
    "acceptance_criteria",
    "priority",
    "story_points",
    "labels",
    "confidence_score",
    "status",
    "jira_issue_key",
    "flags",
    "created_at",
    "updated_at",
  ];

  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const str = Array.isArray(v) ? v.join("; ") : String(v);
    // Wrap in double-quotes if the value contains a comma, newline, or double-quote
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = stories.map((s) =>
    headers.map((h) => escape(s[h as keyof UserStory])).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ stories, label = "stories" }: ExportButtonProps) {
  if (stories.length === 0) return null;

  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);

  function handleExportJSON() {
    const json = JSON.stringify(stories, null, 2);
    downloadBlob(json, `${slug}.json`, "application/json");
  }

  function handleExportCSV() {
    const csv = storiesToCSV(stories);
    downloadBlob(csv, `${slug}.csv`, "text/csv");
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleExportJSON}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Export JSON
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleExportCSV}
        className="gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        Export CSV
      </Button>
    </div>
  );
}
