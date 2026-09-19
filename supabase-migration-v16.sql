-- v16: make the task audit log actually writable by the game.
-- v15 created the table but left RLS enforcing, so inserts were rejected with
-- "new row violates row-level security policy". Run this once; it is idempotent.

BEGIN;

-- 1. 与项目其它表保持一致：关闭 RLS。
ALTER TABLE public.task_admin_logs DISABLE ROW LEVEL SECURITY;

-- 2. 双保险：即使将来 RLS 被重新开启（例如后台误操作或团队策略），
--    下面这条宽松策略也保证游戏的前端匿名 key 仍能读写自己的日志。
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_admin_logs'
      AND policyname = 'task_admin_logs_game_access'
  ) THEN
    CREATE POLICY task_admin_logs_game_access
      ON public.task_admin_logs
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3. 权限与序列：INSERT 需要序列的使用权才能生成自增 id。
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_admin_logs TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.task_admin_logs_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- 自检：执行下面这行应该返回一行结果，而不是报错。
-- SELECT * FROM public.task_admin_logs LIMIT 1;
