-- v12: review each task submission once and create its notification atomically.
-- Safe to run repeatedly in Supabase SQL Editor or with the linked CLI.

BEGIN;

CREATE OR REPLACE FUNCTION public.review_task_submission(
  p_user_role TEXT,
  p_submission_id UUID,
  p_status TEXT,
  p_note TEXT,
  p_reward_chopping INTEGER,
  p_reward_items JSONB,
  p_mail_title TEXT,
  p_mail_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_submission_id UUID;
  v_existing_status TEXT;
BEGIN
  IF p_user_role NOT IN ('player', 'player_live')
     OR p_submission_id IS NULL
     OR p_status NOT IN ('approved', 'rejected')
     OR p_reward_chopping IS NULL OR p_reward_chopping < 0 OR p_reward_chopping > 1000000
     OR p_reward_items IS NULL OR jsonb_typeof(p_reward_items) <> 'array'
     OR jsonb_array_length(p_reward_items) > 100
     OR NULLIF(BTRIM(p_mail_title), '') IS NULL
     OR NULLIF(BTRIM(p_mail_content), '') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_arguments');
  END IF;

  UPDATE public.task_submissions
  SET status = p_status,
      review_note = COALESCE(p_note, ''),
      reviewed_at = NOW(),
      reward_chopping = CASE WHEN p_status = 'approved' THEN p_reward_chopping ELSE 0 END,
      reward_items = CASE WHEN p_status = 'approved' THEN p_reward_items ELSE '[]'::JSONB END
  WHERE id = p_submission_id
    AND user_role = p_user_role
    AND status = 'pending'
  RETURNING id INTO v_submission_id;

  IF v_submission_id IS NULL THEN
    SELECT status INTO v_existing_status
    FROM public.task_submissions
    WHERE id = p_submission_id AND user_role = p_user_role;

    IF v_existing_status IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'code', 'not_found');
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'already_reviewed');
  END IF;

  INSERT INTO public.mails (user_role, title, content, items)
  VALUES (p_user_role, p_mail_title, p_mail_content, '[]'::JSONB);

  RETURN jsonb_build_object('ok', true, 'code', 'ok', 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.review_task_submission(
  TEXT, UUID, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_task_submission(
  TEXT, UUID, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT
) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
