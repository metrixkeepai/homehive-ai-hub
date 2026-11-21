CREATE OR REPLACE FUNCTION public.check_property_owner() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.home_items parent
    WHERE parent.id = NEW.property_id
      AND parent.user_id = NEW.user_id
      AND parent.workspace_id IS NOT DISTINCT FROM NEW.workspace_id
      AND parent.section IN ('my-home', 'locations')
  ) THEN
    RAISE EXCEPTION 'Property not found';
  END IF;
  RETURN NEW;
END $$;
