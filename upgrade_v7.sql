-- ============================================================
-- 寻道大千 · 数据库升级脚本 v7
-- 配置化每日签到奖励，签到记录与奖励发放保持原子性。
-- 幂等设计：可重复执行。
-- ============================================================

DROP FUNCTION IF EXISTS daily_check_in();
DROP FUNCTION IF EXISTS daily_check_in(JSONB);

CREATE OR REPLACE FUNCTION daily_check_in(p_rewards JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := (NOW() AT TIME ZONE 'Asia/Shanghai')::DATE;
  v_month TEXT := TO_CHAR(v_today, 'YYYY-MM');
  v_month_start DATE := DATE_TRUNC('month', v_today::TIMESTAMP)::DATE;
  v_inserted_id BIGINT;
  v_days INTEGER;
  v_chopping_count INTEGER;
  v_claims JSONB;
  v_reward JSONB;
  v_item_id TEXT;
  v_count INTEGER;
  v_coin_reward INTEGER := 0;
  v_chopping_reward INTEGER := 0;
BEGIN
  IF p_rewards IS NULL OR jsonb_typeof(p_rewards) <> 'array'
     OR jsonb_array_length(p_rewards) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_rewards');
  END IF;

  PERFORM 1
  FROM player_state
  WHERE user_role = 'player'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  INSERT INTO daily_checkins (user_role, checkin_date)
  VALUES ('player', v_today)
  ON CONFLICT (user_role, checkin_date) DO NOTHING
  RETURNING id INTO v_inserted_id;

  SELECT COUNT(*)::INTEGER
  INTO v_days
  FROM daily_checkins
  WHERE user_role = 'player'
    AND checkin_date >= v_month_start
    AND checkin_date < (v_month_start + INTERVAL '1 month')::DATE;

  IF v_inserted_id IS NULL THEN
    SELECT chopping_count, COALESCE(signin_claims, '[]'::JSONB)
    INTO v_chopping_count, v_claims
    FROM player_state
    WHERE user_role = 'player';

    RETURN jsonb_build_object(
      'ok', false,
      'code', 'already_checked',
      'date', v_today,
      'month', v_month,
      'days', v_days,
      'choppingCount', v_chopping_count,
      'claims', v_claims
    );
  END IF;

  FOR v_reward IN SELECT value FROM jsonb_array_elements(p_rewards)
  LOOP
    v_item_id := NULLIF(BTRIM(v_reward->>'itemId'), '');
    BEGIN
      v_count := (v_reward->>'count')::INTEGER;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'invalid reward count';
    END;

    IF v_item_id IS NULL OR v_count IS NULL OR v_count <= 0 OR v_count > 999999 THEN
      RAISE EXCEPTION 'invalid reward entry';
    END IF;

    IF v_item_id = '1' THEN
      v_chopping_reward := v_chopping_reward + v_count;
    ELSIF v_item_id = '0' THEN
      v_coin_reward := v_coin_reward + v_count;
    ELSE
      UPDATE inventory
      SET quantity = quantity + v_count,
          updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM inventory
        WHERE user_role = 'player'
          AND item_id = v_item_id
        ORDER BY id
        LIMIT 1
      );

      IF NOT FOUND THEN
        INSERT INTO inventory (user_role, item_id, quantity, updated_at)
        VALUES ('player', v_item_id, v_count, NOW());
      END IF;
    END IF;
  END LOOP;

  UPDATE player_state
  SET chopping_count = chopping_count + v_chopping_reward,
      coin = COALESCE(coin, 0) + v_coin_reward,
      total_coin_earned = COALESCE(total_coin_earned, 0) + v_coin_reward,
      last_daily_date = v_today,
      signin_month = v_month,
      signin_days = v_days,
      signin_claims = CASE
        WHEN signin_month IS DISTINCT FROM v_month THEN '[]'::JSONB
        ELSE COALESCE(signin_claims, '[]'::JSONB)
      END,
      updated_at = NOW()
  WHERE user_role = 'player'
  RETURNING chopping_count, signin_claims
  INTO v_chopping_count, v_claims;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'date', v_today,
    'month', v_month,
    'days', v_days,
    'choppingCount', v_chopping_count,
    'claims', COALESCE(v_claims, '[]'::JSONB),
    'rewards', p_rewards
  );
END;
$$;

REVOKE ALL ON FUNCTION daily_check_in(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION daily_check_in(JSONB) TO anon, authenticated;
