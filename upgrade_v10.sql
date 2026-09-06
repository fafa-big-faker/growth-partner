-- v10: independent weapon instances with permanent forged affixes.
-- Safe to run repeatedly in Supabase SQL Editor or with the linked CLI.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.weapon_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_role TEXT NOT NULL CHECK (user_role IN ('player', 'player_live')),
  item_id TEXT NOT NULL,
  skill_rolls JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT weapon_instances_skill_rolls_array
    CHECK (jsonb_typeof(skill_rolls) = 'array')
);

CREATE INDEX IF NOT EXISTS weapon_instances_user_created_idx
  ON public.weapon_instances (user_role, created_at DESC);

ALTER TABLE public.player_state
  ADD COLUMN IF NOT EXISTS axe_instance_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'player_state_axe_instance_id_fkey'
  ) THEN
    ALTER TABLE public.player_state
      ADD CONSTRAINT player_state_axe_instance_id_fkey
      FOREIGN KEY (axe_instance_id) REFERENCES public.weapon_instances(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Convert every unequipped aggregate axe into one independent instance.
INSERT INTO public.weapon_instances (user_role, item_id, skill_rolls, created_at)
SELECT i.user_role, i.item_id, '[]'::JSONB, COALESCE(i.updated_at, NOW())
FROM public.inventory i
CROSS JOIN LATERAL generate_series(1, i.quantity)
WHERE i.item_id = ANY (ARRAY[
  '51001', '51002', '52001', '52002', '53001',
  '53002', '54001', '54002', '55001'
])
ON CONFLICT DO NOTHING;

DELETE FROM public.inventory
WHERE item_id = ANY (ARRAY[
  '51001', '51002', '52001', '52002', '53001',
  '53002', '54001', '54002', '55001'
]) AND user_role IN ('player', 'player_live');

-- Preserve each player's currently equipped axe as an instance.
INSERT INTO public.weapon_instances (user_role, item_id, skill_rolls)
SELECT ps.user_role, COALESCE(ps.axe_id, '51001'), '[]'::JSONB
FROM public.player_state ps
WHERE ps.axe_instance_id IS NULL
ON CONFLICT DO NOTHING;

UPDATE public.player_state ps
SET axe_instance_id = (
  SELECT wi.id
  FROM public.weapon_instances wi
  WHERE wi.user_role = ps.user_role
    AND wi.item_id = COALESCE(ps.axe_id, '51001')
  ORDER BY wi.created_at, wi.id
  LIMIT 1
)
WHERE ps.axe_instance_id IS NULL;

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
  v_inventory_id public.inventory.id%TYPE;
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

  SELECT id INTO v_inventory_id
  FROM public.inventory
  WHERE user_role = p_user_role AND item_id = p_cost_item_id
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_inventory_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  END IF;

  UPDATE public.inventory
  SET quantity = quantity - p_cost_quantity, updated_at = NOW()
  WHERE id = v_inventory_id AND quantity >= p_cost_quantity
  RETURNING quantity INTO v_remaining;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_materials');
  END IF;
  IF v_remaining = 0 THEN
    DELETE FROM public.inventory WHERE id = v_inventory_id;
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

CREATE OR REPLACE FUNCTION public.initialize_weapon_affixes(
  p_user_role TEXT,
  p_instance_id UUID,
  p_skill_rolls JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rolls JSONB;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR p_instance_id IS NULL
     OR p_skill_rolls IS NULL OR jsonb_typeof(p_skill_rolls) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  UPDATE public.weapon_instances
  SET skill_rolls = p_skill_rolls
  WHERE id = p_instance_id AND user_role = p_user_role
    AND skill_rolls = '[]'::JSONB
  RETURNING skill_rolls INTO v_rolls;

  IF v_rolls IS NULL THEN
    SELECT skill_rolls INTO v_rolls
    FROM public.weapon_instances
    WHERE id = p_instance_id AND user_role = p_user_role;
  END IF;
  IF v_rolls IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'weapon_not_found');
  END IF;
  RETURN jsonb_build_object('ok', true, 'code', 'ok', 'skillRolls', v_rolls);
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_weapon_instance(
  p_user_role TEXT,
  p_item_id TEXT,
  p_skill_rolls JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instance public.weapon_instances%ROWTYPE;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR NULLIF(BTRIM(p_item_id), '') IS NULL
     OR p_skill_rolls IS NULL OR jsonb_typeof(p_skill_rolls) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;
  PERFORM 1 FROM public.player_state WHERE user_role = p_user_role;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  INSERT INTO public.weapon_instances (user_role, item_id, skill_rolls)
  VALUES (p_user_role, p_item_id, p_skill_rolls)
  RETURNING * INTO v_instance;

  RETURN jsonb_build_object(
    'ok', true, 'code', 'ok',
    'weapon', jsonb_build_object(
      'id', v_instance.id,
      'itemId', v_instance.item_id,
      'skillRolls', v_instance.skill_rolls,
      'createdAt', v_instance.created_at
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_weapon_affixes_batch(
  p_user_role TEXT,
  p_updates JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_update JSONB;
  v_instance_id UUID;
  v_rolls JSONB;
  v_saved JSONB;
  v_results JSONB := '[]'::JSONB;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array'
     OR jsonb_array_length(p_updates) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  FOR v_update IN SELECT value FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      v_instance_id := (v_update->>'id')::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_instance_id');
    END;
    v_rolls := v_update->'skillRolls';
    IF v_rolls IS NULL OR jsonb_typeof(v_rolls) <> 'array' THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_skill_rolls');
    END IF;

    v_saved := NULL;
    UPDATE public.weapon_instances
    SET skill_rolls = v_rolls
    WHERE id = v_instance_id AND user_role = p_user_role
      AND skill_rolls = '[]'::JSONB
    RETURNING skill_rolls INTO v_saved;
    IF v_saved IS NULL THEN
      SELECT skill_rolls INTO v_saved
      FROM public.weapon_instances
      WHERE id = v_instance_id AND user_role = p_user_role;
    END IF;
    IF v_saved IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'weapon_not_found');
    END IF;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'id', v_instance_id,
      'skillRolls', v_saved
    ));
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'code', 'ok', 'weapons', v_results);
END;
$$;

CREATE OR REPLACE FUNCTION public.equip_weapon_instance(
  p_user_role TEXT,
  p_instance_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id TEXT;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live') OR p_instance_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  SELECT item_id INTO v_item_id
  FROM public.weapon_instances
  WHERE id = p_instance_id AND user_role = p_user_role
  FOR UPDATE;
  IF v_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'weapon_not_found');
  END IF;

  UPDATE public.player_state
  SET axe_instance_id = p_instance_id, axe_id = v_item_id, updated_at = NOW()
  WHERE user_role = p_user_role;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'code', 'ok', 'itemId', v_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sell_weapon_instance(
  p_user_role TEXT,
  p_instance_id UUID,
  p_price INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id TEXT;
  v_coin INTEGER;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live') OR p_instance_id IS NULL
     OR p_price IS NULL OR p_price < 0 OR p_price > 1000000 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  PERFORM 1 FROM public.player_state
  WHERE user_role = p_user_role
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'player_not_found');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_state
    WHERE user_role = p_user_role AND axe_instance_id = p_instance_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'equipped_weapon');
  END IF;

  SELECT item_id INTO v_item_id
  FROM public.weapon_instances
  WHERE id = p_instance_id AND user_role = p_user_role
  FOR UPDATE;
  IF v_item_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'weapon_not_found');
  END IF;

  DELETE FROM public.weapon_instances
  WHERE id = p_instance_id AND user_role = p_user_role;

  UPDATE public.player_state
  SET coin = COALESCE(coin, 0) + p_price,
      total_coin_earned = COALESCE(total_coin_earned, 0) + p_price,
      updated_at = NOW()
  WHERE user_role = p_user_role
  RETURNING coin INTO v_coin;

  RETURN jsonb_build_object(
    'ok', true, 'code', 'ok', 'itemId', v_item_id, 'coin', v_coin
  );
END;
$$;

ALTER TABLE public.weapon_instances DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.weapon_instances TO anon, authenticated;
REVOKE ALL ON FUNCTION public.forge_weapon_instance(TEXT, TEXT, INTEGER, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.initialize_weapon_affixes(TEXT, UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.initialize_weapon_affixes_batch(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_weapon_instance(TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equip_weapon_instance(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sell_weapon_instance(TEXT, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forge_weapon_instance(TEXT, TEXT, INTEGER, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_weapon_affixes(TEXT, UUID, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_weapon_affixes_batch(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_weapon_instance(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.equip_weapon_instance(TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sell_weapon_instance(TEXT, UUID, INTEGER) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
