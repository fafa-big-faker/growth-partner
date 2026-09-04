-- ============================================================
-- 寻道大千 · 数据库升级脚本 v5
-- 原子合成、领取占位、主题额外奖励持久化。
-- 幂等设计：可重复执行。
-- ============================================================

ALTER TABLE player_state
  ADD COLUMN IF NOT EXISTS theme_reward_claims JSONB DEFAULT '[]'::jsonb;

UPDATE player_state
SET theme_reward_claims = '[]'::jsonb
WHERE theme_reward_claims IS NULL;

ALTER TABLE player_state
  ALTER COLUMN theme_reward_claims SET DEFAULT '[]'::jsonb,
  ALTER COLUMN theme_reward_claims SET NOT NULL;

CREATE OR REPLACE FUNCTION compose_inventory_item(
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
  IF p_source_item_id IS NULL OR p_target_item_id IS NULL
     OR p_source_item_id = p_target_item_id
     OR p_source_quantity IS NULL OR p_target_quantity IS NULL
     OR p_source_quantity <= 0 OR p_target_quantity <= 0
     OR p_source_quantity > 9999 OR p_target_quantity > 9999 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  -- All v5 resource RPCs serialize through the one player row.
  PERFORM 1 FROM player_state WHERE user_role = 'player' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  UPDATE inventory
  SET quantity = quantity - p_source_quantity,
      updated_at = NOW()
  WHERE user_role = 'player'
    AND item_id = p_source_item_id
    AND quantity >= p_source_quantity
  RETURNING quantity INTO v_source_remaining;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  END IF;

  IF v_source_remaining = 0 THEN
    DELETE FROM inventory
    WHERE user_role = 'player'
      AND item_id = p_source_item_id
      AND quantity = 0;
  END IF;

  UPDATE inventory
  SET quantity = quantity + p_target_quantity,
      updated_at = NOW()
  WHERE user_role = 'player'
    AND item_id = p_target_item_id
  RETURNING quantity INTO v_target_quantity;

  IF NOT FOUND THEN
    INSERT INTO inventory (user_role, item_id, quantity)
    VALUES ('player', p_target_item_id, p_target_quantity)
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
  IF p_claim_type NOT IN ('signin', 'achievement', 'theme')
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
    WHEN 'signin' THEN COALESCE(signin_claims, '[]'::jsonb)
    WHEN 'achievement' THEN COALESCE(achievement_claims, '[]'::jsonb)
    WHEN 'theme' THEN COALESCE(theme_reward_claims, '[]'::jsonb)
  END
  INTO v_claims
  FROM player_state
  WHERE user_role = 'player'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  IF v_claims @> jsonb_build_array(v_claim_value) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_claimed');
  END IF;

  IF p_claim_type = 'signin' THEN
    UPDATE player_state
    SET signin_claims = v_claims || jsonb_build_array(v_claim_value)
    WHERE user_role = 'player';
  ELSIF p_claim_type = 'achievement' THEN
    UPDATE player_state
    SET achievement_claims = v_claims || jsonb_build_array(v_claim_value)
    WHERE user_role = 'player';
  ELSE
    UPDATE player_state
    SET theme_reward_claims = v_claims || jsonb_build_array(v_claim_value)
    WHERE user_role = 'player';
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION compose_inventory_item(TEXT, INTEGER, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reserve_player_claim(TEXT, TEXT) TO anon, authenticated;
