-- 団体アカウント。これまで favorites / user_grants は個人にひも付くだけで、
-- 同じNPOの複数人が同じ助成金情報を共有できなかった。
--
-- 設計:
--   - お気に入りは個人のもの。ただし同じ団体のメンバーには見える（誰が何を見ているか分かる）
--   - 自分の登録(user_grants)は org_id を付ければ団体の共有物になり、メンバー全員が編集できる
--   - org_id が NULL の行はこれまでどおり完全に個人のもの。既存データは無変更で動く
--
-- RLSの注意: organization_members のポリシーから organization_members を引くと
-- 無限再帰になる。メンバー判定は SECURITY DEFINER 関数に逃がしてRLSを迂回させる。

-- ---------------------------------------------------------------- テーブル

CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.organization_members (
  org_id UUID NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX organization_members_user_idx ON public.organization_members (user_id);

-- 招待はトークン付きURLを配る方式。メール送信基盤に依存しないで済む。
-- トークンは gen_random_uuid() 2個分（128bit×2）を連結して作る。
-- encode(gen_random_bytes(...)) は pgcrypto 拡張が要るので使わない。
CREATE TABLE public.organization_invites (
  token TEXT NOT NULL PRIMARY KEY
    DEFAULT replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  org_id UUID NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  created_by UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '14 days',
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users ON DELETE SET NULL
);
CREATE INDEX organization_invites_org_idx ON public.organization_invites (org_id);

-- 既存テーブルに所属先を足す。NULL = 個人のもの（従来どおり）。
ALTER TABLE public.favorites
  ADD COLUMN org_id UUID REFERENCES public.organizations ON DELETE SET NULL;
ALTER TABLE public.user_grants
  ADD COLUMN org_id UUID REFERENCES public.organizations ON DELETE SET NULL;
CREATE INDEX favorites_org_idx ON public.favorites (org_id);
CREATE INDEX user_grants_org_idx ON public.user_grants (org_id);

-- ---------------------------------------------------------------- 判定関数

-- SECURITY DEFINER にして organization_members のRLSを迂回する。
-- これをしないと、organization_members のポリシー内で同テーブルを引いた時点で再帰する。
CREATE OR REPLACE FUNCTION public.is_org_member(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = p_org AND m.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
     WHERE m.org_id = p_org AND m.user_id = auth.uid()
       AND m.role IN ('owner', 'admin')
  );
$$;

-- ---------------------------------------------------------------- 権限とRLS

GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_invites TO authenticated;
GRANT ALL ON public.organizations TO service_role;
GRANT ALL ON public.organization_members TO service_role;
GRANT ALL ON public.organization_invites TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- 団体: メンバーだけが見える。名前の変更は管理者、削除はオーナーのみ。
-- INSERT は create_organization() 経由にするのでポリシーを置かない。
CREATE POLICY "Members read their organizations"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id));
CREATE POLICY "Admins update their organization"
  ON public.organizations FOR UPDATE TO authenticated
  USING (public.is_org_admin(id)) WITH CHECK (public.is_org_admin(id));
CREATE POLICY "Creator deletes the organization"
  ON public.organizations FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- メンバー: 同じ団体の人は一覧を見られる。追加・役割変更は管理者。
-- 自分自身の脱退だけは管理者でなくてもできる。
CREATE POLICY "Members read the roster"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));
CREATE POLICY "Admins add members"
  ON public.organization_members FOR INSERT TO authenticated
  WITH CHECK (public.is_org_admin(org_id));
CREATE POLICY "Admins change roles"
  ON public.organization_members FOR UPDATE TO authenticated
  USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));
CREATE POLICY "Admins remove members or a member leaves"
  ON public.organization_members FOR DELETE TO authenticated
  USING (public.is_org_admin(org_id) OR user_id = auth.uid());

-- 招待: 管理者だけが発行・確認・取り消しできる。
-- 招かれた側はトークンを知っているだけなので、accept_organization_invite() で引き換える。
CREATE POLICY "Admins manage invites"
  ON public.organization_invites FOR ALL TO authenticated
  USING (public.is_org_admin(org_id)) WITH CHECK (public.is_org_admin(org_id));

-- ---------------------------------------------------------------- 既存テーブルのRLS差し替え

-- お気に入りは個人のもの。ただし団体を指定した行は同じ団体のメンバーにも見える。
-- 書き換えは本人だけ（他人のお気に入りを消せてはいけない）。
DROP POLICY IF EXISTS "Users manage own favorites" ON public.favorites;
CREATE POLICY "Read own or same-organization favorites"
  ON public.favorites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (org_id IS NOT NULL AND public.is_org_member(org_id)));
CREATE POLICY "Write own favorites"
  ON public.favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR public.is_org_member(org_id)));
CREATE POLICY "Update own favorites"
  ON public.favorites FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND (org_id IS NULL OR public.is_org_member(org_id)));
CREATE POLICY "Delete own favorites"
  ON public.favorites FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 自分の登録は、団体を指定すればメンバー全員で編集できる共有物になる。
DROP POLICY IF EXISTS "Users manage own grants" ON public.user_grants;
CREATE POLICY "Read own or organization grants"
  ON public.user_grants FOR SELECT TO authenticated
  USING (
    (org_id IS NULL AND user_id = auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
  );
CREATE POLICY "Insert own or organization grants"
  ON public.user_grants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (org_id IS NULL OR public.is_org_member(org_id))
  );
CREATE POLICY "Update own or organization grants"
  ON public.user_grants FOR UPDATE TO authenticated
  USING (
    (org_id IS NULL AND user_id = auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
  )
  WITH CHECK (org_id IS NULL OR public.is_org_member(org_id));
CREATE POLICY "Delete own or organization grants"
  ON public.user_grants FOR DELETE TO authenticated
  USING (
    (org_id IS NULL AND user_id = auth.uid())
    OR (org_id IS NOT NULL AND public.is_org_member(org_id))
  );

-- ---------------------------------------------------------------- RPC

-- 団体の作成。organizations への INSERT と、作成者を owner として登録するのは
-- 不可分でなければならない（片方だけ成功すると誰も触れない団体が残る）。
-- また organization_members の INSERT ポリシーは管理者を要求するので、
-- 最初の1人はここを通す必要がある。
CREATE OR REPLACE FUNCTION public.create_organization(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'organization name is required';
  END IF;

  INSERT INTO public.organizations (name, created_by)
  VALUES (trim(p_name), auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');

  RETURN v_id;
END;
$$;

-- 招待の引き換え。招かれた側は organization_invites を読めないので、
-- 有効性の確認と加入をまとめてここで行う。
CREATE OR REPLACE FUNCTION public.accept_organization_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_invite FROM public.organization_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite not found';
  END IF;
  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invite expired';
  END IF;
  IF v_invite.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite already used';
  END IF;

  -- 既に入っている場合は役割を変えずに黙って通す
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_invite.org_id, auth.uid(), v_invite.role)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.organization_invites
     SET accepted_at = now(), accepted_by = auth.uid()
   WHERE token = p_token;

  RETURN v_invite.org_id;
END;
$$;

-- 招待トークンは総当たりされうるので、匿名からは実行させない。
REVOKE ALL ON FUNCTION public.create_organization(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_organization_invite(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invite(TEXT) TO authenticated;

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
