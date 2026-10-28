-- Persist country from business signup metadata onto profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (
    id, display_name, avatar_url, account_type, org_name, sector,
    business_type, org_size, branches, country
  )
  VALUES (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN new.raw_user_meta_data->>'account_type' IN ('business', 'enterprise')
        THEN new.raw_user_meta_data->>'account_type'
      ELSE 'individual'
    END,
    left(new.raw_user_meta_data->>'org_name', 200),
    left(new.raw_user_meta_data->>'sector', 100),
    left(new.raw_user_meta_data->>'business_type', 100),
    left(new.raw_user_meta_data->>'org_size', 50),
    CASE
      WHEN (new.raw_user_meta_data->>'branches') ~ '^[0-9]{1,5}$'
        THEN (new.raw_user_meta_data->>'branches')::int
      ELSE NULL
    END,
    coalesce(nullif(left(new.raw_user_meta_data->>'country', 100), ''), 'United Kingdom')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$function$;
