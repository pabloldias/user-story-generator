"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderOpen, FileText, BookOpen, LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/projects", label: "Projects", icon: FolderOpen },
  { href: "/requirements", label: "Requirements", icon: FileText },
  { href: "/stories", label: "Stories", icon: BookOpen },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-border">
        <span className="inline-block h-2 w-2 rounded-full bg-brand-neon-mint shrink-0" />
        <span className="text-sm font-semibold tracking-tight text-foreground leading-tight">
          Story Generator
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-neon-mint/10 text-brand-squid-ink"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* New requirement shortcut */}
      <div className="px-3 pb-3">
        <Link
          href="/requirements/new"
          className="flex items-center justify-center gap-2 w-full rounded-md bg-brand-neon-mint px-3 py-2 text-sm font-medium text-brand-squid-ink hover:opacity-90 transition-opacity"
        >
          <Sparkles className="h-4 w-4" />
          New Requirement
        </Link>
      </div>

      {/* Sign out */}
      <div className="border-t border-border px-3 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
