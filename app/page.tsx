export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-24">
      <div className="text-center max-w-xl">
        {/* Accent bar */}
        <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-brand-neon-mint" />

        <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-4">
          AI User Story Generator
        </h1>
        <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
          Convert unstructured business requirements into structured, Jira-ready user stories.
        </p>
        <p className="inline-block rounded-full bg-brand-aqua-breeze px-4 py-1.5 text-sm font-medium text-brand-squid-ink">
          Phase 1 scaffolding complete — proceed to Phase 2 (Supabase schema &amp; auth).
        </p>
      </div>
    </main>
  );
}
