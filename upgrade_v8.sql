-- v8: isolated test/live player data and role-aware atomic operations.
-- Safe to run repeatedly in Supabase SQL Editor.

INSERT INTO player_state (
  user_role, level, exp, chopping_count, tree_level, tree_realm, realm_level,
  axe_id, balance, total_withdrawn, last_daily_date, coin, signin_month,
  signin_days, signin_claims, shop_purchases, total_chops, total_coin_earned,
  achievement_claims, theme_reward_claims
)
SELECT
  'player_live', 1, 0, 10, 0, 0, 1, '51001', 0, 0, NULL, 0, NULL,
  0, '[]'::JSONB, '{}'::JSONB, 0, 0, '[]'::JSONB, '[]'::JSONB
WHERE NOT EXISTS (SELECT 1 FROM player_state WHERE user_role = 'player_live');

CREATE OR REPLACE FUNCTION compose_inventory_item(
  p_user_role TEXT,
  p_source_item_id TEXT,
  p_source_quantity INTEGER,
  p_target_item_id TEXT,
  p_target_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_source_id BIGINT;
  v_source_remaining INTEGER;
  v_target_id BIGINT;
  v_target_quantity INTEGER;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR p_source_item_id IS NULL OR p_target_item_id IS NULL
     OR p_source_item_id = p_target_item_id
     OR p_source_quantity IS NULL OR p_target_quantity IS NULL
     OR p_source_quantity <= 0 OR p_target_quantity <= 0
     OR p_source_quantity > 9999 OR p_target_quantity > 9999 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  PERFORM 1 FROM player_state WHERE user_role = p_user_role FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  SELECT id INTO v_source_id
  FROM inventory
  WHERE user_role = p_user_role AND item_id = p_source_item_id
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_source_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  END IF;

  UPDATE inventory
  SET quantity = quantity - p_source_quantity, updated_at = NOW()
  WHERE id = v_source_id AND quantity >= p_source_quantity
  RETURNING quantity INTO v_source_remaining;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  END IF;

  IF v_source_remaining = 0 THEN
    DELETE FROM inventory WHERE id = v_source_id;
  END IF;

  SELECT id INTO v_target_id
  FROM inventory
  WHERE user_role = p_user_role AND item_id = p_target_item_id
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_target_id IS NULL THEN
    INSERT INTO inventory (user_role, item_id, quantity, updated_at)
    VALUES (p_user_role, p_target_item_id, p_target_quantity, NOW())
    RETURNING quantity INTO v_target_quantity;
  ELSE
    UPDATE inventory
    SET quantity = quantity + p_target_quantity, updated_at = NOW()
    WHERE id = v_target_id
    RETURNING quantity INTO v_target_quantity;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'sourceQuantity', v_source_remaining,
    'targetQuantity', v_target_quantity
  );
END;
$$;

CREATE OR REPLACE FUNCTION reserve_player_claim(
  p_user_role TEXT,
  p_claim_type TEXT,
  p_claim_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claims JSONB;
  v_claim_value JSONB;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR p_claim_type NOT IN ('signin', 'achievement', 'theme')
     OR p_claim_key IS NULL OR BTRIM(p_claim_key) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  IF p_claim_type IN ('signin', 'achievement') THEN
    BEGIN
      v_claim_value := to_jsonb(p_claim_key::INTEGER);
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_claim_key');
    END;
  ELSE
    v_claim_value := to_jsonb(p_claim_key);
  END IF;

  SELECT CASE p_claim_type
    WHEN 'signin' THEN COALESCE(signin_claims, '[]'::JSONB)
    WHEN 'achievement' THEN COALESCE(achievement_claims, '[]'::JSONB)
    WHEN 'theme' THEN COALESCE(theme_reward_claims, '[]'::JSONB)
  END
  INTO v_claims
  FROM player_state
  WHERE user_role = p_user_role
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;
  IF v_claims @> jsonb_build_array(v_claim_value) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_claimed');
  END IF;

  IF p_claim_type = 'signin' THEN
    UPDATE player_state SET signin_claims = v_claims || jsonb_build_array(v_claim_value)
    WHERE user_role = p_user_role;
  ELSIF p_claim_type = 'achievement' THEN
    UPDATE player_state SET achievement_claims = v_claims || jsonb_build_array(v_claim_value)
    WHERE user_role = p_user_role;
  ELSE
    UPDATE player_state SET theme_reward_claims = v_claims || jsonb_build_array(v_claim_value)
    WHERE user_role = p_user_role;
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'ok');
END;
$$;

CREATE OR REPLACE FUNCTION daily_check_in(p_user_role TEXT, p_rewards JSONB)
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
  v_inventory_id BIGINT;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR p_rewards IS NULL OR jsonb_typeof(p_rewards) <> 'array'
     OR jsonb_array_length(p_rewards) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_rewards');
  END IF;

  PERFORM 1 FROM player_state WHERE user_role = p_user_role FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  INSERT INTO daily_checkins (user_role, checkin_date)
  VALUES (p_user_role, v_today)
  ON CONFLICT (user_role, checkin_date) DO NOTHING
  RETURNING id INTO v_inserted_id;

  SELECT COUNT(*)::INTEGER INTO v_days
  FROM daily_checkins
  WHERE user_role = p_user_role
    AND checkin_date >= v_month_start
    AND checkin_date < (v_month_start + INTERVAL '1 month')::DATE;

  IF v_inserted_id IS NULL THEN
    SELECT chopping_count, COALESCE(signin_claims, '[]'::JSONB)
    INTO v_chopping_count, v_claims
    FROM player_state WHERE user_role = p_user_role;
    RETURN jsonb_build_object(
      'ok', false, 'code', 'already_checked', 'date', v_today, 'month', v_month,
      'days', v_days, 'choppingCount', v_chopping_count, 'claims', v_claims
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
      SELECT id INTO v_inventory_id
      FROM inventory
      WHERE user_role = p_user_role AND item_id = v_item_id
      ORDER BY id LIMIT 1 FOR UPDATE;
      IF v_inventory_id IS NULL THEN
        INSERT INTO inventory (user_role, item_id, quantity, updated_at)
        VALUES (p_user_role, v_item_id, v_count, NOW());
      ELSE
        UPDATE inventory SET quantity = quantity + v_count, updated_at = NOW()
        WHERE id = v_inventory_id;
      END IF;
      v_inventory_id := NULL;
    END IF;
  END LOOP;

  UPDATE player_state
  SET chopping_count = chopping_count + v_chopping_reward,
      coin = COALESCE(coin, 0) + v_coin_reward,
      total_coin_earned = COALESCE(total_coin_earned, 0) + v_coin_reward,
      last_daily_date = v_today,
      signin_month = v_month,
      signin_days = v_days,
      signin_claims = CASE WHEN signin_month IS DISTINCT FROM v_month THEN '[]'::JSONB
                           ELSE COALESCE(signin_claims, '[]'::JSONB) END,
      updated_at = NOW()
  WHERE user_role = p_user_role
  RETURNING chopping_count, signin_claims INTO v_chopping_count, v_claims;

  RETURN jsonb_build_object(
    'ok', true, 'code', 'ok', 'date', v_today, 'month', v_month, 'days', v_days,
    'choppingCount', v_chopping_count, 'claims', COALESCE(v_claims, '[]'::JSONB),
    'rewards', p_rewards
  );
END;
$$;

REVOKE ALL ON FUNCTION daily_check_in(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compose_inventory_item(TEXT, TEXT, INTEGER, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_player_claim(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION daily_check_in(TEXT, JSONB) TO anon, authenticated;
