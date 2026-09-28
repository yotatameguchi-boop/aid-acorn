// integrations/supabase/types.ts は Lovable が自動生成するファイルで、
// 「編集するな」と明記されている。団体アカウントで足したテーブルと、
// favorites / user_grants に足した org_id 列はまだ反映されていない。
//
// 生成が追いつくまでの間、不足分の型をここで宣言してクライアントを被せ直す。
// 型を諦めて any や as never を撒くより、ここ1箇所に閉じ込めたほうが安全。
// types.ts が再生成されたら、このファイルは消して素の supabase に戻せる。
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type OrgRole = "owner" | "admin" | "member";

export type Organization = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type OrganizationMember = {
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
};

export type OrganizationInvite = {
  token: string;
  org_id: string;
  role: OrgRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
};

type FavoriteRow = {
  user_id: string;
  grant_id: string;
  org_id: string | null;
  created_at: string;
};

type UserGrantRow = {
  id: string;
  user_id: string;
  org_id: string | null;
  title: string;
  organization: string;
  category: string;
  amount_min: number;
  amount_max: number;
  application_start: string;
  application_end: string;
  target: string;
  description: string;
  url: string | null;
  region: string;
  created_at: string;
  updated_at: string;
};

export type ExtendedDatabase = {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: { name: string; created_by: string };
        Update: { name?: string };
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMember;
        Insert: { org_id: string; user_id: string; role?: OrgRole };
        Update: { role?: OrgRole };
        Relationships: [];
      };
      organization_invites: {
        Row: OrganizationInvite;
        Insert: { org_id: string; created_by: string; role?: OrgRole };
        Update: { accepted_at?: string | null };
        Relationships: [];
      };
      favorites: {
        Row: FavoriteRow;
        Insert: { user_id: string; grant_id: string; org_id?: string | null };
        Update: { org_id?: string | null };
        Relationships: [];
      };
      user_grants: {
        Row: UserGrantRow;
        Insert: Omit<UserGrantRow, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Omit<UserGrantRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_organization: { Args: { p_name: string }; Returns: string };
      accept_organization_invite: { Args: { p_token: string }; Returns: string };
    };
    Enums: { org_role: OrgRole };
    CompositeTypes: Record<string, never>;
  };
};

export const db = supabase as unknown as SupabaseClient<ExtendedDatabase>;
