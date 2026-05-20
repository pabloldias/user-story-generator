-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003 — Add rejection_feedback to requirements
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.requirements
  add column if not exists rejection_feedback text;
