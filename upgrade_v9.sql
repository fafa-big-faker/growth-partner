-- Repair UUID inventory references in atomic item grants.
-- Safe to run repeatedly in Supabase SQL Editor or with `supabase db query --linked`.

BEGIN;

DROP FUNCTION IF EXISTS public.compose_inventory_item(TEXT, INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.compose_inventory_item(TEXT, TEXT, INTEGER, TEXT, INTEGER);

CREATE FUNCTION public.compose_inventory_item(
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
  v_source_id inventory.id%TYPE;
  v_source_remaining INTEGER;
  v_target_id inventory.id%TYPE;
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

CREATE OR REPLACE FUNCTION public.daily_check_in(p_user_role TEXT, p_rewards JSONB)
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
  v_inventory_id inventory.id%TYPE;
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

REVOKE ALL ON FUNCTION public.daily_check_in(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compose_inventory_item(TEXT, TEXT, INTEGER, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_check_in(TEXT, JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
