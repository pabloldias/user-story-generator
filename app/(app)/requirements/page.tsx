import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Requirement } from "@/types";

export default async function RequirementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: requirements } = await supabase
    .from("requirements")
    .select("*")
    .order("created_at", { ascending: false });

  const reqs = (requirements as Requirement[]) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Requirements</h1>
          <p className="text-muted-foreground text-sm mt-1">
            All submitted requirements and their pipeline status.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/requirements/new">
            <PlusCircle className="h-4 w-4 mr-1.5" />
            New Requirement
          </Link>
        </Button>
      </div>

      {reqs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-sm text-muted-foreground">No requirements yet.</p>
            <Button asChild size="sm" variant="outline">
              <Link href="/requirements/new">Generate your first user stories</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {reqs.map((req) => (
            <Link key={req.id} href={`/requirements/${req.id}`}>
              <Card className="hover:shadow-sm transition-shadow border-border cursor-pointer">
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <p className="text-sm truncate min-w-0">{req.raw_input}</p>
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
    </div>
  );
}
