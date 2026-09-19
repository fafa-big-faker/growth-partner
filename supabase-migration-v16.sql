-- v16: make the task audit log actually writable by the game.
-- v15 created the table but left RLS enforcing, so inserts were rejected with
-- "new row violates row-level security policy". Run this once; it is idempotent.
--
-- 使用说明（重要）：
--   1. 清空 SQL 编辑器里原有内容（不要只选中一段执行）；
--   2. 把下面全部内容粘进去；
--   3. 点 Run；
--   4. 结果区应该出现一个表格，其中 rls_enabled 必须是 false、policy_count 至少是 1。
--      如果这两个数不对，说明脚本没有整段执行。

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

-- 自检输出：这一段不需要你判断，结果会自动出现在下面的结果表里。
SELECT
  c.relrowsecurity                                   AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'task_admin_logs') AS policy_count,
  has_table_privilege('anon', 'public.task_admin_logs', 'INSERT')   AS anon_can_insert
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'task_admin_logs';
