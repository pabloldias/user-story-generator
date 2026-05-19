-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 001 — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── projects ────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

-- ─── requirements ────────────────────────────────────────────────────────────
create type public.requirement_source_type as enum ('text', 'document', 'email');
create type public.requirement_status      as enum ('pending', 'processing', 'completed', 'failed');

create table if not exists public.requirements (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  raw_input   text not null,
  source_type public.requirement_source_type not null default 'text',
  status      public.requirement_status      not null default 'pending',
  created_at  timestamptz not null default now()
);

-- ─── user_stories ─────────────────────────────────────────────────────────────
create type public.story_status as enum (
  'draft', 'under_review', 'approved', 'needs_changes', 'exported'
);
create type public.story_priority as enum ('Low', 'Medium', 'High', 'Critical');

create table if not exists public.user_stories (
  id                   uuid primary key default gen_random_uuid(),
  requirement_id       uuid not null references public.requirements (id) on delete cascade,
  title                text not null,
  story_body           text not null,
  acceptance_criteria  text not null,
  priority             public.story_priority not null default 'Medium',
  story_points         int  check (story_points in (1, 2, 3, 5, 8, 13)),
  labels               text[] not null default '{}',
  confidence_score     float check (confidence_score >= 0 and confidence_score <= 1),
  flags                text[] not null default '{}',
  status               public.story_status not null default 'draft',
  jira_issue_key       text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─── story_edits (audit log) ─────────────────────────────────────────────────
create table if not exists public.story_edits (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid not null references public.user_stories (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  field       text not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);

-- ─── guardrail_logs ───────────────────────────────────────────────────────────
create table if not exists public.guardrail_logs (
  id          uuid primary key default gen_random_uuid(),
  story_id    uuid references public.user_stories (id) on delete set null,
  rule        text not null,
  passed      boolean not null,
  details     text,
  created_at  timestamptz not null default now()
);

-- ─── updated_at trigger ───────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_stories_updated_at
  before update on public.user_stories
  for each row execute function public.set_updated_at();
