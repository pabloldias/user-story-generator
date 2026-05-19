export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-4">AI User Story Generator</h1>
        <p className="text-muted-foreground text-lg mb-8">
          Convert unstructured business requirements into structured, Jira-ready user stories.
        </p>
        <p className="text-sm text-muted-foreground">
          Phase 1 scaffolding complete — proceed to Phase 2 (Supabase schema &amp; auth).
        </p>
      </div>
    </main>
  );
}
