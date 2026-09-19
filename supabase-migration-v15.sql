-- v15: task admin audit log + soft-delete (archive) support.
-- Safe to run repeatedly in the Supabase SQL Editor or with the linked CLI.

BEGIN;

-- 1. 天道操作日志：谁在什么时候新建/发布/撤回/归档/审核了哪条任务。
CREATE TABLE IF NOT EXISTS public.task_admin_logs (
  id BIGSERIAL PRIMARY KEY,
  user_role TEXT NOT NULL,
  action TEXT NOT NULL,
  task_id UUID,
  task_title TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'task_admin_logs_user_role_check'
      AND conrelid = 'public.task_admin_logs'::regclass
  ) THEN
    ALTER TABLE public.task_admin_logs
      ADD CONSTRAINT task_admin_logs_user_role_check
      CHECK (user_role IN ('player', 'player_live'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS task_admin_logs_role_created_idx
  ON public.task_admin_logs (user_role, created_at DESC);

-- 2. 任务状态允许 archived：删除改为归档，提交记录不会再指向已消失的任务。
DO $$
DECLARE
  existing_constraint TEXT;
BEGIN
  FOR existing_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.xiu_tasks'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      AND pg_get_constraintdef(con.oid) ILIKE '%draft%'
  LOOP
    EXECUTE format('ALTER TABLE public.xiu_tasks DROP CONSTRAINT %I', existing_constraint);
  END LOOP;
END $$;

ALTER TABLE public.xiu_tasks
  DROP CONSTRAINT IF EXISTS xiu_tasks_status_check;
ALTER TABLE public.xiu_tasks
  ADD CONSTRAINT xiu_tasks_status_check
  CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS xiu_tasks_audience_status_created_idx
  ON public.xiu_tasks (audience_role, status, sort_order, created_at);

-- 3. 与项目其它表保持一致：关闭 RLS，匿名 publishable key 直接读写。
ALTER TABLE public.task_admin_logs DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.task_admin_logs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.task_admin_logs_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
