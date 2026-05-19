import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle, FileText, BookOpen, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project, Requirement } from "@/types";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch projects + recent requirements in parallel
  const [{ data: projects }, { data: requirements }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("requirements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Welcome back — here's a summary of your projects and recent activity.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/projects/new">
              <PlusCircle className="h-4 w-4 mr-1.5" />
              New Project
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/requirements/new">
              <FileText className="h-4 w-4 mr-1.5" />
              New Requirement
            </Link>
          </Button>
        </div>
      </div>

      {/* Projects */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Projects</h2>
          <Link
            href="/projects"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {!projects || projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-sm text-muted-foreground">No projects yet.</p>
              <Button asChild size="sm" variant="outline">
                <Link href="/projects/new">
                  <PlusCircle className="h-4 w-4 mr-1.5" />
                  Create your first project
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(projects as Project[]).map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card className="h-full hover:shadow-md transition-shadow border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold line-clamp-1">
                      {project.name}
                    </CardTitle>
                    {project.description && (
                      <CardDescription className="text-xs line-clamp-2">
                        {project.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Requirements */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Recent Requirements</h2>
          <Link
            href="/requirements"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {!requirements || requirements.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-sm text-muted-foreground">No requirements yet.</p>
              <Button asChild size="sm" variant="outline">
                <Link href="/requirements/new">Generate your first user stories</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {(requirements as Requirement[]).map((req) => (
              <Link key={req.id} href={`/requirements/${req.id}`}>
                <Card className="hover:shadow-sm transition-shadow border-border">
                  <CardContent className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className="text-sm truncate">{req.raw_input}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                          req.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : req.status === "processing"
                            ? "bg-blue-50 text-blue-700"
                            : req.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {req.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
