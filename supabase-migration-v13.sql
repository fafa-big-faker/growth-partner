-- v13: merge duplicate stackable inventory rows and make mutations atomic.
-- Safe to run repeatedly with the linked Supabase project.

BEGIN;

-- Keep one stable row per player/item and preserve the complete quantity.
WITH grouped AS (
  SELECT user_role,
         item_id,
         (ARRAY_AGG(id ORDER BY updated_at NULLS LAST, id))[1] AS keep_id,
         SUM(quantity)::INTEGER AS total_quantity
  FROM public.inventory
  GROUP BY user_role, item_id
)
UPDATE public.inventory AS inventory
SET quantity = grouped.total_quantity,
    updated_at = NOW()
FROM grouped
WHERE inventory.id = grouped.keep_id;

DELETE FROM public.inventory AS inventory
USING (
  SELECT user_role,
         item_id,
         (ARRAY_AGG(id ORDER BY updated_at NULLS LAST, id))[1] AS keep_id
  FROM public.inventory
  GROUP BY user_role, item_id
) AS keepers
WHERE inventory.user_role = keepers.user_role
  AND inventory.item_id = keepers.item_id
  AND inventory.id <> keepers.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS inventory_user_item_unique_idx
  ON public.inventory (user_role, item_id);

CREATE OR REPLACE FUNCTION public.add_inventory_item(
  p_user_role TEXT,
  p_item_id TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity INTEGER;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR NULLIF(BTRIM(p_item_id), '') IS NULL
     OR p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 999999 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  PERFORM 1 FROM public.player_state
  WHERE user_role = p_user_role
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  INSERT INTO public.inventory AS inventory (user_role, item_id, quantity, updated_at)
  VALUES (p_user_role, p_item_id, p_quantity, NOW())
  ON CONFLICT (user_role, item_id) DO UPDATE
  SET quantity = inventory.quantity + EXCLUDED.quantity,
      updated_at = NOW()
  RETURNING quantity INTO v_quantity;

  RETURN jsonb_build_object('ok', true, 'code', 'ok', 'quantity', v_quantity);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_inventory_item(
  p_user_role TEXT,
  p_item_id TEXT,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quantity INTEGER;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR NULLIF(BTRIM(p_item_id), '') IS NULL
     OR p_quantity IS NULL OR p_quantity <= 0 OR p_quantity > 999999 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  PERFORM 1 FROM public.player_state
  WHERE user_role = p_user_role
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  UPDATE public.inventory
  SET quantity = quantity - p_quantity,
      updated_at = NOW()
  WHERE user_role = p_user_role
    AND item_id = p_item_id
    AND quantity >= p_quantity
  RETURNING quantity INTO v_quantity;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  END IF;

  IF v_quantity = 0 THEN
    DELETE FROM public.inventory
    WHERE user_role = p_user_role AND item_id = p_item_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'ok', 'quantity', v_quantity);
END;
$$;

DROP FUNCTION IF EXISTS public.compose_inventory_item(TEXT, INTEGER, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.compose_inventory_item(TEXT, TEXT, INTEGER, TEXT, INTEGER);

CREATE OR REPLACE FUNCTION public.compose_inventory_item(
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
  v_source_remaining INTEGER;
  v_target_quantity INTEGER;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR NULLIF(BTRIM(p_source_item_id), '') IS NULL
     OR NULLIF(BTRIM(p_target_item_id), '') IS NULL
     OR p_source_item_id = p_target_item_id
     OR p_source_quantity IS NULL OR p_target_quantity IS NULL
     OR p_source_quantity <= 0 OR p_target_quantity <= 0
     OR p_source_quantity > 9999 OR p_target_quantity > 9999 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  PERFORM 1 FROM public.player_state
  WHERE user_role = p_user_role
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  UPDATE public.inventory
  SET quantity = quantity - p_source_quantity,
      updated_at = NOW()
  WHERE user_role = p_user_role
    AND item_id = p_source_item_id
    AND quantity >= p_source_quantity
  RETURNING quantity INTO v_source_remaining;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  END IF;

  IF v_source_remaining = 0 THEN
    DELETE FROM public.inventory
    WHERE user_role = p_user_role AND item_id = p_source_item_id;
  END IF;

  INSERT INTO public.inventory AS inventory (user_role, item_id, quantity, updated_at)
  VALUES (p_user_role, p_target_item_id, p_target_quantity, NOW())
  ON CONFLICT (user_role, item_id) DO UPDATE
  SET quantity = inventory.quantity + EXCLUDED.quantity,
      updated_at = NOW()
  RETURNING quantity INTO v_target_quantity;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'sourceQuantity', v_source_remaining,
    'targetQuantity', v_target_quantity
  );
END;
$$;

DROP FUNCTION IF EXISTS public.daily_check_in(JSONB);

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
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR p_rewards IS NULL OR jsonb_typeof(p_rewards) <> 'array'
     OR jsonb_array_length(p_rewards) > 100 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_rewards');
  END IF;

  PERFORM 1 FROM public.player_state
  WHERE user_role = p_user_role
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  INSERT INTO public.daily_checkins (user_role, checkin_date)
  VALUES (p_user_role, v_today)
  ON CONFLICT (user_role, checkin_date) DO NOTHING
  RETURNING id INTO v_inserted_id;

  SELECT COUNT(*)::INTEGER INTO v_days
  FROM public.daily_checkins
  WHERE user_role = p_user_role
    AND checkin_date >= v_month_start
    AND checkin_date < (v_month_start + INTERVAL '1 month')::DATE;

  IF v_inserted_id IS NULL THEN
    SELECT chopping_count, COALESCE(signin_claims, '[]'::JSONB)
    INTO v_chopping_count, v_claims
    FROM public.player_state
    WHERE user_role = p_user_role;
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
      INSERT INTO public.inventory AS inventory (user_role, item_id, quantity, updated_at)
      VALUES (p_user_role, v_item_id, v_count, NOW())
      ON CONFLICT (user_role, item_id) DO UPDATE
      SET quantity = inventory.quantity + EXCLUDED.quantity,
          updated_at = NOW();
    END IF;
  END LOOP;

  UPDATE public.player_state
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
  WHERE user_role = p_user_role
  RETURNING chopping_count, signin_claims INTO v_chopping_count, v_claims;

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

CREATE OR REPLACE FUNCTION public.forge_weapon_instance(
  p_user_role TEXT,
  p_cost_item_id TEXT,
  p_cost_quantity INTEGER,
  p_item_id TEXT,
  p_skill_rolls JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining INTEGER;
  v_instance public.weapon_instances%ROWTYPE;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR NULLIF(BTRIM(p_cost_item_id), '') IS NULL
     OR NULLIF(BTRIM(p_item_id), '') IS NULL
     OR p_cost_quantity IS NULL OR p_cost_quantity <= 0 OR p_cost_quantity > 9999
     OR p_skill_rolls IS NULL OR jsonb_typeof(p_skill_rolls) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  PERFORM 1 FROM public.player_state
  WHERE user_role = p_user_role
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  UPDATE public.inventory
  SET quantity = quantity - p_cost_quantity,
      updated_at = NOW()
  WHERE user_role = p_user_role
    AND item_id = p_cost_item_id
    AND quantity >= p_cost_quantity
  RETURNING quantity INTO v_remaining;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  END IF;

  IF v_remaining = 0 THEN
    DELETE FROM public.inventory
    WHERE user_role = p_user_role AND item_id = p_cost_item_id;
  END IF;

  INSERT INTO public.weapon_instances (user_role, item_id, skill_rolls)
  VALUES (p_user_role, p_item_id, p_skill_rolls)
  RETURNING * INTO v_instance;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'ok',
    'remainingMaterial', v_remaining,
    'weapon', jsonb_build_object(
      'id', v_instance.id,
      'itemId', v_instance.item_id,
      'skillRolls', v_instance.skill_rolls,
      'createdAt', v_instance.created_at
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_inventory_item(TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_inventory_item(TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compose_inventory_item(TEXT, TEXT, INTEGER, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.daily_check_in(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.forge_weapon_instance(TEXT, TEXT, INTEGER, TEXT, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_inventory_item(TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_inventory_item(TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compose_inventory_item(TEXT, TEXT, INTEGER, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_check_in(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.forge_weapon_instance(TEXT, TEXT, INTEGER, TEXT, JSONB) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
