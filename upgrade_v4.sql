-- ============================================================
-- 寻道大千 · 数据库升级脚本 v4（累计迁移，含 v3 全部内容）
-- 幂等设计：可重复执行；老库执行这一个脚本即可补齐 v3+v4 所有字段。
--
-- v3 内容：游戏币(coin)、本月累签(signin_*)、商店月限购(shop_purchases)
-- v4 新增：成就累计统计(total_chops / total_coin_earned / achievement_claims)
--          主题任务字段兜底(theme_name / theme_start / theme_end / theme_extra_reward)
-- 对应需求：成就奖励表（修身/锻体/致富 三页签 6 类成就）；
--           主题任务（周期活动，天道设定起止时间，过期隐藏显示“尽情期待”）。
-- ============================================================

-- 1. 玩家状态表：游戏币 + 累签 + 商店限购（v3）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='coin') THEN
    ALTER TABLE player_state ADD COLUMN coin INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='signin_month') THEN
    ALTER TABLE player_state ADD COLUMN signin_month TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='signin_days') THEN
    ALTER TABLE player_state ADD COLUMN signin_days INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='signin_claims') THEN
    ALTER TABLE player_state ADD COLUMN signin_claims JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='shop_purchases') THEN
    ALTER TABLE player_state ADD COLUMN shop_purchases JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. 玩家状态表：成就系统累计统计（v4）
--    total_chops        : 累计消耗砍树次数（成就类型4）
--    total_coin_earned  : 历史累计获得游戏币（成就类型5：财源广进）
--    achievement_claims : 已领取的成就ID数组（如 [1,2,3]）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='total_chops') THEN
    ALTER TABLE player_state ADD COLUMN total_chops INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='total_coin_earned') THEN
    ALTER TABLE player_state ADD COLUMN total_coin_earned INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='achievement_claims') THEN
    ALTER TABLE player_state ADD COLUMN achievement_claims JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 3. 任务表：主题任务字段兜底（v4）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='xiu_tasks' AND column_name='theme_name') THEN
    ALTER TABLE xiu_tasks ADD COLUMN theme_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='xiu_tasks' AND column_name='theme_start') THEN
    ALTER TABLE xiu_tasks ADD COLUMN theme_start TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='xiu_tasks' AND column_name='theme_end') THEN
    ALTER TABLE xiu_tasks ADD COLUMN theme_end TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='xiu_tasks' AND column_name='theme_extra_reward') THEN
    ALTER TABLE xiu_tasks ADD COLUMN theme_extra_reward JSONB DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 4. 兜底：历史数据补默认值，避免 NULL
UPDATE player_state SET coin = 0 WHERE coin IS NULL;
UPDATE player_state SET signin_days = 0 WHERE signin_days IS NULL;
UPDATE player_state SET signin_claims = '[]'::jsonb WHERE signin_claims IS NULL;
UPDATE player_state SET shop_purchases = '{}'::jsonb WHERE shop_purchases IS NULL;
UPDATE player_state SET total_chops = 0 WHERE total_chops IS NULL;
UPDATE player_state SET total_coin_earned = 0 WHERE total_coin_earned IS NULL;
UPDATE player_state SET achievement_claims = '[]'::jsonb WHERE achievement_claims IS NULL;

-- 5. 关闭 RLS（确保匿名访问，与 v1/v2/v3 保持一致）
ALTER TABLE player_state DISABLE ROW LEVEL SECURITY;
ALTER TABLE xiu_tasks DISABLE ROW LEVEL SECURITY;
