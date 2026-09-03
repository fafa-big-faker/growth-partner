-- ============================================================
-- 寻道大千 · 数据库升级脚本 v3
-- 在 v2 基础上新增：游戏币(coin)、本月累签追踪字段
-- 对应需求：道具表新增 type0=游戏币 / type6=砍树次数（不进背包）；
--           天道酬勤商店（游戏币购买）；本月累签里程碑奖励。
-- ============================================================

-- 1. 玩家状态表：新增游戏币字段
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='coin') THEN
    ALTER TABLE player_state ADD COLUMN coin INT DEFAULT 0;
  END IF;
END $$;

-- 2. 玩家状态表：新增本月累签追踪字段
--    signin_month  : 当前累计签到所属月份（'YYYY-MM'），跨月自动清零
--    signin_days   : 本月已累计签到天数
--    signin_claims : 本月已领取的累签里程碑奖励ID数组（如 [1,2]）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='signin_month') THEN
    ALTER TABLE player_state ADD COLUMN signin_month TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='signin_days') THEN
    ALTER TABLE player_state ADD COLUMN signin_days INT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='signin_claims') THEN
    ALTER TABLE player_state ADD COLUMN signin_claims JSONB DEFAULT '[]'::jsonb;
  END IF;
  -- 商店月限购计数：{ "YYYY-MM": { "<shop_id>": <已购次数> } }
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='player_state' AND column_name='shop_purchases') THEN
    ALTER TABLE player_state ADD COLUMN shop_purchases JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 3. 兜底：给历史玩家补默认值，避免 NULL
UPDATE player_state SET coin = 0 WHERE coin IS NULL;
UPDATE player_state SET signin_days = 0 WHERE signin_days IS NULL;
UPDATE player_state SET signin_claims = '[]'::jsonb WHERE signin_claims IS NULL;
UPDATE player_state SET shop_purchases = '{}'::jsonb WHERE shop_purchases IS NULL;

-- 4. 关闭 RLS（确保匿名访问，与 v1/v2 保持一致）
ALTER TABLE player_state DISABLE ROW LEVEL SECURITY;
