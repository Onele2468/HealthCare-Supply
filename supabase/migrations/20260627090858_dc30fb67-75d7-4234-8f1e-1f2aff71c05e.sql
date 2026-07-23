CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_org_code()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  _code text;
  _try int := 0;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  LOOP
    _code := 'SUP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.organizations WHERE code = _code);
    _try := _try + 1;
    IF _try > 10 THEN RAISE EXCEPTION 'Could not generate unique org code'; END IF;
  END LOOP;
  NEW.code := _code;
  RETURN NEW;
END $function$;
