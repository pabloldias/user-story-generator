-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 002 — Row Level Security
-- Run this AFTER 001_initial_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── projects ────────────────────────────────────────────────────────────────
alter table public.projects enable row level security;

create policy "projects: owner can select"
  on public.projects for select
  using (auth.uid() = user_id);

create policy "projects: owner can insert"
  on public.projects for insert
  with check (auth.uid() = user_id);

create policy "projects: owner can update"
  on public.projects for update
  using (auth.uid() = user_id);

create policy "projects: owner can delete"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ─── requirements ────────────────────────────────────────────────────────────
alter table public.requirements enable row level security;

create policy "requirements: owner can select"
  on public.requirements for select
  using (auth.uid() = user_id);

create policy "requirements: owner can insert"
  on public.requirements for insert
  with check (auth.uid() = user_id);

create policy "requirements: owner can update"
  on public.requirements for update
  using (auth.uid() = user_id);

create policy "requirements: owner can delete"
  on public.requirements for delete
  using (auth.uid() = user_id);

-- ─── user_stories ─────────────────────────────────────────────────────────────
alter table public.user_stories enable row level security;

-- stories are owned by the user who owns the parent requirement
create policy "user_stories: owner can select"
  on public.user_stories for select
  using (
    exists (
      select 1 from public.requirements r
      where r.id = user_stories.requirement_id
        and r.user_id = auth.uid()
    )
  );

create policy "user_stories: owner can insert"
  on public.user_stories for insert
  with check (
    exists (
      select 1 from public.requirements r
      where r.id = user_stories.requirement_id
        and r.user_id = auth.uid()
    )
  );

create policy "user_stories: owner can update"
  on public.user_stories for update
  using (
    exists (
      select 1 from public.requirements r
      where r.id = user_stories.requirement_id
        and r.user_id = auth.uid()
    )
  );

create policy "user_stories: owner can delete"
  on public.user_stories for delete
  using (
    exists (
      select 1 from public.requirements r
      where r.id = user_stories.requirement_id
        and r.user_id = auth.uid()
    )
  );

-- ─── story_edits ─────────────────────────────────────────────────────────────
alter table public.story_edits enable row level security;

create policy "story_edits: owner can select"
  on public.story_edits for select
  using (auth.uid() = user_id);

create policy "story_edits: owner can insert"
  on public.story_edits for insert
  with check (auth.uid() = user_id);

-- ─── guardrail_logs ───────────────────────────────────────────────────────────
alter table public.guardrail_logs enable row level security;

-- guardrail logs are readable only if the user owns the linked story
create policy "guardrail_logs: owner can select"
  on public.guardrail_logs for select
  using (
    story_id is null
    or exists (
      select 1
        from public.user_stories us
        join public.requirements r on r.id = us.requirement_id
       where us.id = guardrail_logs.story_id
         and r.user_id = auth.uid()
    )
  );
