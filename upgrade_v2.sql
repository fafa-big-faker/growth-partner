-- ============================================================
-- 寻道大千 · 数据库升级脚本 v2
-- 在 v1 基础上新增：仙阶、仙树灵阶、主题任务、任务发布状态等
-- ============================================================

-- 1. 玩家状态表：新增仙阶和仙树灵阶字段
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='realm_level') THEN
    ALTER TABLE player_state ADD COLUMN realm_level INT DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='tree_realm') THEN
    ALTER TABLE player_state ADD COLUMN tree_realm INT DEFAULT 1;
  END IF;
END $$;

-- 2. 任务表：新增主题任务相关字段和发布状态
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='xiu_tasks' AND column_name='theme_name') THEN
    ALTER TABLE xiu_tasks ADD COLUMN theme_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='xiu_tasks' AND column_name='theme_start') THEN
    ALTER TABLE xiu_tasks ADD COLUMN theme_start DATE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='xiu_tasks' AND column_name='theme_end') THEN
    ALTER TABLE xiu_tasks ADD COLUMN theme_end DATE;
  END IF;
END $$;

-- 3. 邮件表：新增 is_deleted 字段（软删除）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mails' AND column_name='is_deleted') THEN
    ALTER TABLE mails ADD COLUMN is_deleted BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 4. 重置玩家状态为初始值（确保字段有值）
UPDATE player_state SET realm_level = 1 WHERE realm_level IS NULL;
UPDATE player_state SET tree_realm = 1 WHERE tree_realm IS NULL;

-- 5. 关闭所有表的 RLS（确保匿名访问）
ALTER TABLE player_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE xiu_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE task_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE mails DISABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals DISABLE ROW LEVEL SECURITY;
