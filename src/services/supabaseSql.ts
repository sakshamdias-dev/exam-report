export const SUPABASE_SCHEMA_SQL = `-- ============================================================================
-- ONLINE EXAMINATION PORTAL - SUPABASE POSTGRESQL SCHEMA & INITIAL SEED DATA
-- Platform: Supabase (PostgreSQL 15+)
-- Hosting Domain: https://examreport.examfriendly.in
-- File Storage: Google Drive Only (Stored as drive.google.com URLs in DB)
-- ============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. USERS TABLE (Students, Teachers, Evaluators, Admins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. STUDENT GROUPS TABLE (Batches, Sections, Classes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.student_groups (
  group_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  student_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. EXAMS TABLE (Exam Schedules, Subjects, Question Papers on Google Drive)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
  exam_id TEXT PRIMARY KEY,
  subject TEXT NOT NULL DEFAULT 'General Examination',
  total_marks NUMERIC DEFAULT 100,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  qp_url TEXT DEFAULT '', -- Google Drive preview / download link
  assignment_type TEXT DEFAULT 'ALL' CHECK (assignment_type IN ('ALL', 'GROUPS', 'STUDENTS')),
  assigned_groups JSONB DEFAULT '[]'::jsonb,
  assigned_students JSONB DEFAULT '[]'::jsonb,
  allow_late_submissions BOOLEAN DEFAULT TRUE,
  submission_overrides JSONB DEFAULT '[]'::jsonb,
  meet_url TEXT DEFAULT '',
  require_google_meet BOOLEAN DEFAULT FALSE,
  results_released BOOLEAN DEFAULT FALSE,
  results_released_at TIMESTAMPTZ,
  question_marks JSONB DEFAULT '[]'::jsonb, -- Question-wise rubric for OSM
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. SUBMISSIONS TABLE (Student Answer Booklets & Graded Booklets on Drive)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.submissions (
  student_id TEXT NOT NULL,
  exam_id TEXT NOT NULL REFERENCES public.exams(exam_id) ON DELETE CASCADE,
  submission_url TEXT NOT NULL, -- Google Drive PDF link of student answer booklet
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_url TEXT DEFAULT '',   -- Google Drive PDF link of evaluated/annotated booklet
  score NUMERIC,
  feedback TEXT DEFAULT '',
  student_name TEXT DEFAULT '',
  status TEXT DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'GRADED', 'RECHECK_REQUESTED', 'RECHECK_RESOLVED')),
  recheck_reason TEXT DEFAULT '',
  recheck_grounds TEXT DEFAULT '',
  recheck_requested_at TIMESTAMPTZ,
  recheck_remarks TEXT DEFAULT '',
  recheck_resolved_at TIMESTAMPTZ,
  question_scores JSONB DEFAULT '{}'::jsonb,
  osm_draft_data TEXT DEFAULT '',
  checked_at TIMESTAMPTZ,
  evaluator_id TEXT DEFAULT '',
  PRIMARY KEY (student_id, exam_id)
);

-- ============================================================================
-- 6. PAPERS TABLE (Exam paper blueprints & subject mapping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.papers (
  paper_id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES public.exams(exam_id) ON DELETE CASCADE,
  subject TEXT DEFAULT '',
  total_marks NUMERIC DEFAULT 100,
  file_url TEXT DEFAULT '', -- Google Drive file URL
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 7. DOUBTS TABLE (In-Exam & Evaluation Clarifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.doubts (
  doubt_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  exam_id TEXT NOT NULL REFERENCES public.exams(exam_id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT DEFAULT '',
  status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ANSWERED')),
  student_name TEXT DEFAULT '',
  page_ref TEXT DEFAULT '',
  question_ref TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  answered_at TIMESTAMPTZ
);

-- ============================================================================
-- 8. PROCTOR LOGS TABLE (Integrity, Tab Switch, and Violation Auditing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.proctor_logs (
  id BIGSERIAL PRIMARY KEY,
  exam_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  details TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_submissions_exam_id ON public.submissions(exam_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_exams_start_end ON public.exams(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_doubts_exam_id ON public.doubts(exam_id);
CREATE INDEX IF NOT EXISTS idx_doubts_student_id ON public.doubts(student_id);
CREATE INDEX IF NOT EXISTS idx_proctor_logs_exam_student ON public.proctor_logs(exam_id, student_id);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Enables seamless anonymous & authenticated access from https://examreport.examfriendly.in
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctor_logs ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated roles full read/write for the exam portal client
DROP POLICY IF EXISTS "Allow portal public read users" ON public.users;
CREATE POLICY "Allow portal public read users" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal public access student_groups" ON public.student_groups;
CREATE POLICY "Allow portal public access student_groups" ON public.student_groups FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal public access exams" ON public.exams;
CREATE POLICY "Allow portal public access exams" ON public.exams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal public access submissions" ON public.submissions;
CREATE POLICY "Allow portal public access submissions" ON public.submissions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal public access papers" ON public.papers;
CREATE POLICY "Allow portal public access papers" ON public.papers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal public access doubts" ON public.doubts;
CREATE POLICY "Allow portal public access doubts" ON public.doubts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow portal public access proctor_logs" ON public.proctor_logs;
CREATE POLICY "Allow portal public access proctor_logs" ON public.proctor_logs FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 11. SUPABASE REALTIME REPLICATION (Instant grade updates & submissions)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'exams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exams;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'doubts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.doubts;
  END IF;
END $$;

-- ============================================================================
-- 12. INITIAL SEED DATA
-- Default Teacher, Students, and Groups
-- ============================================================================
INSERT INTO public.users (user_id, name, password, role)
VALUES
  ('TEACH-01', 'Prof. Saksham Dias', 'teacher123', 'teacher'),
  ('2026X001', 'Aarav Sharma', 'student123', 'student'),
  ('2026X002', 'Diya Patel', 'student123', 'student'),
  ('2026X003', 'Rohan Verma', 'student123', 'student'),
  ('2026X004', 'Ananya Iyer', 'student123', 'student')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.student_groups (group_id, name, description, student_ids)
VALUES
  ('GRP-CSE-A', 'Computer Science - Section A', 'Final Year CSE Candidates', '["2026X001", "2026X002"]'::jsonb),
  ('GRP-ECE-B', 'Electronics & Comm - Section B', 'Pre-Final Year ECE Candidates', '["2026X003", "2026X004"]'::jsonb)
ON CONFLICT (group_id) DO NOTHING;

-- Initial Demo Exam (linking Google Drive question paper)
INSERT INTO public.exams (
  exam_id,
  subject,
  total_marks,
  start_time,
  end_time,
  qp_url,
  assignment_type,
  assigned_groups,
  assigned_students,
  allow_late_submissions,
  results_released,
  question_marks
)
VALUES (
  'EXAM-DEMO-01',
  'Advanced Data Structures & Algorithms',
  100,
  NOW() - INTERVAL '1 hour',
  NOW() + INTERVAL '3 hours',
  'https://drive.google.com/file/d/1633-ahfN9DNHng9ym-cFgsjMAHIe9-sH/preview',
  'ALL',
  '[]'::jsonb,
  '[]'::jsonb,
  TRUE,
  FALSE,
  '[
    {"id": "Q1", "label": "Q1. Binary Search Trees & AVL Balancing", "maxMarks": 25},
    {"id": "Q2", "label": "Q2. Graph Traversal: Dijkstra vs Bellman-Ford", "maxMarks": 25},
    {"id": "Q3", "label": "Q3. Dynamic Programming: 0/1 Knapsack", "maxMarks": 25},
    {"id": "Q4", "label": "Q4. String Matching: Knuth-Morris-Pratt Algorithm", "maxMarks": 25}
  ]'::jsonb
)
ON CONFLICT (exam_id) DO NOTHING;
`;
