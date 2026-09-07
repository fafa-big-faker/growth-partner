-- v11: isolate task submissions by account and restore task submission writes.
-- Safe to run repeatedly in Supabase SQL Editor or with the linked CLI.

BEGIN;

ALTER TABLE public.task_submissions
  ADD COLUMN IF NOT EXISTS user_role TEXT;

-- All submissions created before live accounts existed belong to the test account.
UPDATE public.task_submissions
SET user_role = 'player'
WHERE user_role IS NULL OR BTRIM(user_role) = '';

ALTER TABLE public.task_submissions
  ALTER COLUMN user_role SET DEFAULT 'player',
  ALTER COLUMN user_role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_submissions_user_role_check'
      AND conrelid = 'public.task_submissions'::regclass
  ) THEN
    ALTER TABLE public.task_submissions
      ADD CONSTRAINT task_submissions_user_role_check
      CHECK (user_role IN ('player', 'player_live'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS task_submissions_user_submitted_idx
  ON public.task_submissions (user_role, submitted_at DESC);

ALTER TABLE public.task_submissions DISABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_submissions TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
