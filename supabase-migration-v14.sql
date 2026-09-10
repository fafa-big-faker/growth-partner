-- v14: isolate task publishing between test and live account pairs.
-- Safe to run repeatedly. Existing shared tasks become live tasks and are
-- copied exactly once as an independent test snapshot.

BEGIN;

ALTER TABLE public.xiu_tasks
  ADD COLUMN IF NOT EXISTS audience_role TEXT,
  ADD COLUMN IF NOT EXISTS environment_seed_key TEXT;

UPDATE public.xiu_tasks
SET audience_role = 'player_live',
    environment_seed_key = COALESCE(environment_seed_key, 'legacy-live:' || id::TEXT)
WHERE audience_role IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'xiu_tasks_audience_role_check'
      AND conrelid = 'public.xiu_tasks'::regclass
  ) THEN
    ALTER TABLE public.xiu_tasks
      ADD CONSTRAINT xiu_tasks_audience_role_check
      CHECK (audience_role IN ('player', 'player_live'));
  END IF;
END $$;

ALTER TABLE public.xiu_tasks ALTER COLUMN audience_role SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS xiu_tasks_environment_seed_key_uidx
  ON public.xiu_tasks (environment_seed_key)
  WHERE environment_seed_key IS NOT NULL;

INSERT INTO public.xiu_tasks (
  task_type, title, description, difficulty,
  reward_chopping, reward_items, status, sort_order, created_at,
  theme_name, theme_start, theme_end, is_published, theme_extra_reward,
  audience_role, environment_seed_key
)
SELECT
  source.task_type, source.title, source.description, source.difficulty,
  source.reward_chopping, source.reward_items, source.status, source.sort_order, source.created_at,
  source.theme_name, source.theme_start, source.theme_end, source.is_published, source.theme_extra_reward,
  'player', 'legacy-test:' || source.id::TEXT
FROM public.xiu_tasks AS source
WHERE source.audience_role = 'player_live'
  AND source.environment_seed_key = 'legacy-live:' || source.id::TEXT
ON CONFLICT (environment_seed_key) WHERE environment_seed_key IS NOT NULL DO NOTHING;

CREATE INDEX IF NOT EXISTS xiu_tasks_audience_status_sort_idx
  ON public.xiu_tasks (audience_role, status, sort_order);

NOTIFY pgrst, 'reload schema';

COMMIT;
