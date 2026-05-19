"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { RequirementInput } from "@/components/RequirementInput";
import type { Project } from "@/types";

interface RequirementInputClientProps {
  projects: Pick<Project, "id" | "name">[];
  defaultProjectId: string;
}

export function RequirementInputClient({
  projects,
  defaultProjectId,
}: RequirementInputClientProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-select">Project</Label>
        <select
          id="project-select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <RequirementInput projectId={selectedProjectId} />
    </div>
  );
}
