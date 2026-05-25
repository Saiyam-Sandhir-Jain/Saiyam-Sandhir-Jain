-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add social_links JSONB column to about_profile
-- Run this once in your Supabase SQL editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.about_profile
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[
    {"label": "LinkedIn", "url": "https://www.linkedin.com/in/saiyam-sandhir/", "icon": "linkedin"},
    {"label": "GitHub",   "url": "https://github.com/Saiyam-Sandhir-Jain", "icon": "github"},
    {"label": "Scholar",  "url": "https://scholar.google.com/citations?user=z8ZgGqQAAAAJ&hl=en", "icon": "scholar"}
  ]'::jsonb;


UPDATE public.about_profile
  SET social_links = '[
    {"label": "LinkedIn", "url": "https://www.linkedin.com/in/saiyam-sandhir/", "icon": "linkedin"},
    {"label": "GitHub",   "url": "https://github.com/Saiyam-Sandhir-Jain",     "icon": "github"},
    {"label": "Scholar",  "url": "https://scholar.google.com/citations?user=z8ZgGqQAAAAJ&hl=en", "icon": "scholar"}
  ]'::jsonb;
