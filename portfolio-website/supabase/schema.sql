-- ============================================================
-- Saiyam Sandhir Jain — Portfolio Admin Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ─── 1. PROFILE TABLE (single row) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.about_profile (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL DEFAULT 'I''m Saiyam Jain',
  first_name  text NOT NULL DEFAULT 'Saiyam',
  last_name   text NOT NULL DEFAULT 'Jain',
  initials    text NOT NULL DEFAULT 'SJ',
  title       text NOT NULL DEFAULT 'AI & Machine Learning Engineer',
  bio         text NOT NULL DEFAULT 'I specialize in developing and deploying high-performance AI solutions, with a strong foundation in machine learning research and full-stack engineering.',
  email       text NOT NULL DEFAULT '',
  avatar_url  text,
  resume_url  text,
  available   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz DEFAULT now()
);

-- Seed with default profile data
INSERT INTO public.about_profile (name, first_name, last_name, initials, title, bio, email, available)
VALUES (
  'I''m Saiyam Jain', 'Saiyam', 'Jain', 'SJ',
  'AI & Machine Learning Engineer',
  'I specialize in developing and deploying high-performance AI solutions, with a strong foundation in machine learning research and full-stack engineering.',
  'saiyam.sandhir.jain@gmail.com',
  true
) ON CONFLICT DO NOTHING;

-- ─── 2. EXPERIENCE TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.experience (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role        text NOT NULL,
  company     text NOT NULL,
  start_date  text NOT NULL,
  end_date    text NOT NULL DEFAULT 'Present',
  is_current  boolean NOT NULL DEFAULT false,
  url         text DEFAULT '#',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Seed with default experiences
INSERT INTO public.experience (role, company, start_date, end_date, is_current, sort_order) VALUES
  ('SDE Intern',              'PenguinApps', 'Sep 2025', 'Present', true,  0),
  ('Undergraduate Researcher','VIT Bhopal',  'Jan 2023', 'Present', true,  1),
  ('Summer Intern',           'SmartInternz','Jun 2025', 'Jul 2025', false, 2),
  ('Contributor',             'GSSOC',       'May 2024', 'Aug 2024', false, 3)
ON CONFLICT DO NOTHING;

-- ─── 3. SKILLS TABLE (exactly 3 slots) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.skills (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot       integer NOT NULL UNIQUE CHECK (slot IN (1, 2, 3)),
  category   text NOT NULL,
  size       text NOT NULL DEFAULT 'full' CHECK (size IN ('full', 'half')),
  tags       text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Seed with 3 skill tiles
INSERT INTO public.skills (slot, category, size, tags) VALUES
  (1, 'Generative AI & NLP',    'full', ARRAY['LLMs','RAG','Transformers','LangChain','HuggingFace','Prompt Eng.']),
  (2, 'Full-Stack Development', 'half', ARRAY['Next.js','React','Node.js','PostgreSQL','MongoDB']),
  (3, 'ML & Research',          'half', ARRAY['PyTorch','TensorFlow','Scikit-learn','Research Writing'])
ON CONFLICT (slot) DO NOTHING;

-- ─── 4. HIGHLIGHTS TABLE (exactly 3 slots: project, research, patent) ───────
CREATE TABLE IF NOT EXISTS public.highlights (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot             text NOT NULL UNIQUE CHECK (slot IN ('project', 'research', 'patent')),
  heading          text NOT NULL DEFAULT '',
  subheading       text NOT NULL DEFAULT '',
  image_url        text,
  modal_heading    text NOT NULL DEFAULT '',
  modal_subheading text NOT NULL DEFAULT '',
  modal_abstract   text NOT NULL DEFAULT '',
  modal_tags       text[] NOT NULL DEFAULT '{}',
  modal_links      jsonb NOT NULL DEFAULT '[]',
  updated_at       timestamptz DEFAULT now()
);

-- Seed with 3 highlight tiles
INSERT INTO public.highlights (slot, heading, subheading, modal_heading, modal_subheading, modal_abstract, modal_tags, modal_links) VALUES
  ('project',  'Project Tile',          'GenAI & Web Development', 'Project Tile', 'GenAI & Web Development', '', ARRAY[]::text[], '[]'),
  ('research', 'Research Paper Tile',   'Research Work',           'Research Paper Tile', 'Research Work', '', ARRAY[]::text[], '[]'),
  ('patent',   'Patent Tile',           'Product Design',          'Patent Tile', 'Product Design', '', ARRAY[]::text[], '[]')
ON CONFLICT (slot) DO NOTHING;

-- ─── 5. ENABLE ROW LEVEL SECURITY ───────────────────────────────────────────
ALTER TABLE public.about_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights     ENABLE ROW LEVEL SECURITY;

-- ─── 6. PUBLIC READ POLICIES (anon can read everything) ─────────────────────
CREATE POLICY "Public read about_profile"
  ON public.about_profile FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read experience"
  ON public.experience FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read skills"
  ON public.skills FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read highlights"
  ON public.highlights FOR SELECT TO anon, authenticated USING (true);

-- ─── 7. AUTHENTICATED WRITE POLICIES ────────────────────────────────────────
-- The service_role key (used in server actions) bypasses RLS entirely.
-- These policies add a safety net so only logged-in users can write
-- even if a misconfigured client is used.

CREATE POLICY "Auth write about_profile"
  ON public.about_profile FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth write experience"
  ON public.experience FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth write skills"
  ON public.skills FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth write highlights"
  ON public.highlights FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 8. STORAGE BUCKETS ──────────────────────────────────────────────────────
-- Run these in the Supabase SQL Editor OR create them in Storage UI

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars',    'avatars',    true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('resumes',    'resumes',    true, 10485760, ARRAY['application/pdf']),
  ('highlights', 'highlights', true, 5242880,  ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Public read resumes"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'resumes');

CREATE POLICY "Public read highlights"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'highlights');

-- Storage RLS: authenticated write (service_role bypasses this anyway)
CREATE POLICY "Auth write avatars"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Auth update avatars"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Auth delete avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Auth write resumes"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "Auth update resumes"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'resumes');

CREATE POLICY "Auth delete resumes"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'resumes');

CREATE POLICY "Auth write highlights"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'highlights');

CREATE POLICY "Auth update highlights"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'highlights');

CREATE POLICY "Auth delete highlights"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'highlights');

-- ─── 9. EXPLORATIONS TABLES ──────────────────────────────────────────────────

-- research_papers
CREATE TABLE IF NOT EXISTS public.research_papers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  status       text NOT NULL CHECK (status IN ('published', 'upcoming')),
  venue        text NOT NULL,
  year         integer NOT NULL,
  authors      text[] NOT NULL DEFAULT '{}',
  abstract     text NOT NULL DEFAULT '',
  tags         text[] NOT NULL DEFAULT '{}',
  scholar_url  text,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- patents
CREATE TABLE IF NOT EXISTS public.patents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  status              text NOT NULL CHECK (status IN ('filed', 'granted', 'upcoming')),
  registration_number text NOT NULL DEFAULT '',
  year                integer NOT NULL,
  abstract            text NOT NULL DEFAULT '',
  tags                text[] NOT NULL DEFAULT '{}',
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz DEFAULT now()
);

-- certificates
CREATE TABLE IF NOT EXISTS public.certificates (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  issuer     text NOT NULL,
  platform   text NOT NULL,
  year       text NOT NULL,
  image_url  text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- lors
CREATE TABLE IF NOT EXISTS public.lors (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommender_name  text NOT NULL,
  organization      text NOT NULL,
  designation       text NOT NULL,
  relationship      text NOT NULL,
  available         boolean NOT NULL DEFAULT true,
  pdf_url           text,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz DEFAULT now()
);

-- ─── 10. ALTER HIGHLIGHTS — FK COLUMNS ───────────────────────────────────────

ALTER TABLE public.highlights
  ADD COLUMN IF NOT EXISTS selected_paper_id  uuid REFERENCES public.research_papers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS selected_patent_id uuid REFERENCES public.patents(id)          ON DELETE SET NULL;

-- ─── 11. RLS FOR NEW TABLES ───────────────────────────────────────────────────

ALTER TABLE public.research_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lors            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read research_papers"
  ON public.research_papers FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read patents"
  ON public.patents FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read certificates"
  ON public.certificates FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read lors"
  ON public.lors FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Auth write research_papers"
  ON public.research_papers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth write patents"
  ON public.patents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth write certificates"
  ON public.certificates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth write lors"
  ON public.lors FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 12. STORAGE BUCKETS — CERTIFICATES & LORS ───────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('certificates', 'certificates', true, 5242880,  ARRAY['image/jpeg','image/jpg','image/png']),
  ('lors',         'lors',         true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read certificates"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'certificates');

CREATE POLICY "Public read lors"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'lors');

CREATE POLICY "Auth write certificates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Auth update certificates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'certificates');

CREATE POLICY "Auth delete certificates"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'certificates');

CREATE POLICY "Auth write lors"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lors');

CREATE POLICY "Auth update lors"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lors');

CREATE POLICY "Auth delete lors"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lors');

-- ─── 13. SUPABASE AUTH — ENABLE GOOGLE PROVIDER ──────────────────────────────
-- Do this in: Supabase Dashboard → Authentication → Providers → Google
-- Set:
--   Client ID:     <your Google OAuth client ID>
--   Client Secret: <your Google OAuth client secret>
--   Redirect URL:  https://<your-domain>/auth/callback
--                  (for local dev: http://localhost:3000/auth/callback)
