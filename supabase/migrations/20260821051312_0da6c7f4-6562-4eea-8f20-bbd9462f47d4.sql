CREATE TABLE public.grants (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_min BIGINT NOT NULL DEFAULT 0,
  amount_max BIGINT NOT NULL DEFAULT 0,
  application_start DATE NOT NULL,
  application_end DATE NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  url TEXT,
  region TEXT NOT NULL DEFAULT '全国',
  source TEXT NOT NULL DEFAULT 'curated',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.grants TO anon;
GRANT SELECT ON public.grants TO authenticated;
GRANT ALL ON public.grants TO service_role;
ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read grants" ON public.grants FOR SELECT USING (true);
CREATE INDEX grants_application_end_idx ON public.grants (application_end);
CREATE INDEX grants_category_idx ON public.grants (category);
CREATE INDEX grants_region_idx ON public.grants (region);

CREATE TABLE public.favorites (
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  grant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, grant_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  organization TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '地域振興',
  amount_min BIGINT NOT NULL DEFAULT 0,
  amount_max BIGINT NOT NULL DEFAULT 0,
  application_start DATE NOT NULL,
  application_end DATE NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  url TEXT,
  region TEXT NOT NULL DEFAULT '全国',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_grants TO authenticated;
GRANT ALL ON public.user_grants TO service_role;
ALTER TABLE public.user_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own grants" ON public.user_grants FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sync_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sync_runs TO anon;
GRANT SELECT ON public.sync_runs TO authenticated;
GRANT ALL ON public.sync_runs TO service_role;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read sync runs" ON public.sync_runs FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER grants_set_updated_at BEFORE UPDATE ON public.grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER user_grants_set_updated_at BEFORE UPDATE ON public.user_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();