import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { RequirementInputClient } from "@/components/RequirementInputClient";
import type { Project } from "@/types";

interface Props {
  searchParams: Promise<{ project_id?: string }>;
}

export default async function NewRequirementPage({ searchParams }: Props) {
  const { project_id } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch projects for the selector
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false });

  const safeProjects = (projects as Pick<Project, "id" | "name">[] | null) ?? [];
  const defaultProjectId = project_id ?? safeProjects[0]?.id ?? "";

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Requirement</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Paste your raw business requirement and the AI pipeline will generate structured user
            stories.
          </p>
        </div>
      </div>

      {safeProjects.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need at least one project before generating stories.{" "}
          <Link href="/projects/new" className="font-medium underline underline-offset-4">
            Create a project
          </Link>
        </div>
      ) : (
        <RequirementInputClient
          projects={safeProjects}
          defaultProjectId={defaultProjectId}
        />
      )}
    </div>
  );
}
