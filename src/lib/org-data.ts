// 団体アカウントの読み書き。テーブルの型は db-extended.ts に置いている
// （types.ts はLovableの自動生成で、まだ新テーブルを知らないため）。
import {
  db,
  type OrgRole,
  type Organization,
  type OrganizationMember,
  type OrganizationInvite,
} from "@/lib/db-extended";

export type { OrgRole, Organization, OrganizationMember, OrganizationInvite };

function fail(message: string): never {
  throw new Error(message);
}

/** 自分が所属している団体。名前順。 */
export async function fetchMyOrganizations(): Promise<Organization[]> {
  const { data, error } = await db
    .from("organizations")
    .select("id,name,created_by,created_at")
    .order("name");
  if (error) fail(error.message);
  return data ?? [];
}

/** 団体を作り、自分をownerとして登録する。DB側のRPCで不可分に行う。 */
export async function createOrganization(name: string): Promise<string> {
  const { data, error } = await db.rpc("create_organization", { p_name: name });
  if (error) fail(error.message);
  return data as string;
}

export async function renameOrganization(orgId: string, name: string): Promise<void> {
  const { error } = await db.from("organizations").update({ name }).eq("id", orgId);
  if (error) fail(error.message);
}

export async function fetchMembers(orgId: string): Promise<OrganizationMember[]> {
  const { data, error } = await db
    .from("organization_members")
    .select("org_id,user_id,role,created_at")
    .eq("org_id", orgId)
    .order("created_at");
  if (error) fail(error.message);
  return data ?? [];
}

/** 招待を発行してトークンを返す。発行できるのは管理者のみ（RLSで制限）。 */
export async function createInvite(orgId: string, userId: string, role: OrgRole = "member") {
  const { data, error } = await db
    .from("organization_invites")
    .insert({ org_id: orgId, created_by: userId, role })
    .select("token,org_id,role,created_at,expires_at,accepted_at")
    .single();
  if (error) fail(error.message);
  return data as OrganizationInvite;
}

/** 未使用かつ期限内の招待。 */
export async function fetchPendingInvites(orgId: string): Promise<OrganizationInvite[]> {
  const { data, error } = await db
    .from("organization_invites")
    .select("token,org_id,role,created_at,expires_at,accepted_at")
    .eq("org_id", orgId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) fail(error.message);
  return data ?? [];
}

export async function revokeInvite(token: string): Promise<void> {
  const { error } = await db.from("organization_invites").delete().eq("token", token);
  if (error) fail(error.message);
}

/** 招待を引き換えて加入する。所属した団体のidを返す。 */
export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await db.rpc("accept_organization_invite", { p_token: token });
  if (error) fail(error.message);
  return data as string;
}

export async function leaveOrganization(orgId: string, userId: string): Promise<void> {
  const { error } = await db
    .from("organization_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", userId);
  if (error) fail(error.message);
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  return leaveOrganization(orgId, userId);
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
};

/** 招待URL。ドメインを固定したくないので実行時のオリジンから組み立てる。 */
export function inviteUrl(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/invite/${token}`;
}

// 選択中の団体はこの端末に覚えておく。利用者ごとに分ける（共用PC対策）。
const ACTIVE_ORG_KEY = "tsunagu-josei:active-org:v1";

export function getActiveOrgId(userId: string): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ORG_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string | null>;
    return map?.[userId] ?? null;
  } catch {
    return null;
  }
}

export function setActiveOrgId(userId: string, orgId: string | null): void {
  try {
    const raw = localStorage.getItem(ACTIVE_ORG_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string | null>) : {};
    map[userId] = orgId;
    localStorage.setItem(ACTIVE_ORG_KEY, JSON.stringify(map));
  } catch {
    /* 覚えられなくても、その場の選択は効く */
  }
}
