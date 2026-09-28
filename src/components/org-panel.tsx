import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Copy,
  Link2,
  Loader2,
  LogOut,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  ROLE_LABEL,
  createInvite,
  createOrganization,
  fetchMembers,
  fetchPendingInvites,
  inviteUrl,
  leaveOrganization,
  removeMember,
  renameOrganization,
  revokeInvite,
  type Organization,
  type OrganizationInvite,
  type OrganizationMember,
} from "@/lib/org-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function OrgDialog({
  open,
  onOpenChange,
  org,
  userId,
  onChanged,
  onLeft,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  org: Organization | null;
  userId: string;
  onChanged: (createdOrgId?: string) => void;
  onLeft: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {org ? org.name : "団体を作る"}
          </DialogTitle>
        </DialogHeader>
        {org ? (
          <OrgSettings
            org={org}
            userId={userId}
            onChanged={onChanged}
            onLeft={() => {
              onOpenChange(false);
              onLeft();
            }}
          />
        ) : (
          <CreateOrgForm
            onCreated={(orgId) => {
              onOpenChange(false);
              onChanged(orgId);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateOrgForm({ onCreated }: { onCreated: (orgId: string) => void }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const orgId = await createOrganization(name.trim());
      toast.success(`「${name.trim()}」を作りました。メンバーを招待できます。`);
      onCreated(orgId);
    } catch (e) {
      toast.error(`団体を作れませんでした: ${errorText(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        団体を作ると、助成金の登録をメンバー全員で共有・編集できます。お気に入りは個人のままです。
      </p>
      <div>
        <Label className="text-xs">団体名</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="例）NPO法人つなぐ市民ネット"
          autoFocus
        />
      </div>
      <Button onClick={submit} disabled={saving || !name.trim()} className="w-full gap-1">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        作成する
      </Button>
    </div>
  );
}

function OrgSettings({
  org,
  userId,
  onChanged,
  onLeft,
}: {
  org: Organization;
  userId: string;
  onChanged: (createdOrgId?: string) => void;
  onLeft: () => void;
}) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invites, setInvites] = useState<OrganizationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(org.name);
  const [busy, setBusy] = useState(false);

  const me = members.find((m) => m.user_id === userId);
  const isAdmin = me?.role === "owner" || me?.role === "admin";

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      // 招待一覧は管理者しか読めない（RLS）。一般メンバーでは空で返る。
      const [m, i] = await Promise.all([
        fetchMembers(org.id),
        fetchPendingInvites(org.id).catch(() => [] as OrganizationInvite[]),
      ]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      toast.error(`団体の情報を読めませんでした: ${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, [org.id]);

  useEffect(() => {
    setName(org.name);
    void reload();
  }, [org.id, org.name, reload]);

  const run = async (label: string, fn: () => Promise<void>, after?: () => void) => {
    setBusy(true);
    try {
      await fn();
      if (after) after();
      else await reload();
    } catch (e) {
      toast.error(`${label}に失敗しました: ${errorText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const issueInvite = () =>
    run("招待の発行", async () => {
      const invite = await createInvite(org.id, userId);
      await copyToClipboard(inviteUrl(invite.token));
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 読み込み中…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div>
          <Label className="text-xs">団体名</Label>
          <div className="mt-1.5 flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button
              variant="outline"
              disabled={busy || !name.trim() || name.trim() === org.name}
              onClick={() =>
                run(
                  "名前の変更",
                  async () => {
                    await renameOrganization(org.id, name.trim());
                    toast.success("団体名を変更しました。");
                  },
                  onChanged,
                )
              }
            >
              保存
            </Button>
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold">
            <Users className="h-4 w-4" /> メンバー（{members.length}）
          </h4>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={issueInvite}
              disabled={busy}
            >
              <UserPlus className="h-3 w-3" /> 招待リンクを作る
            </Button>
          )}
        </div>
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"
            >
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {ROLE_LABEL[m.role]}
                </Badge>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {m.user_id === userId ? "あなた" : `${m.user_id.slice(0, 8)}…`}
                </span>
              </span>
              {isAdmin && m.user_id !== userId && m.role !== "owner" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => run("メンバーの削除", () => removeMember(org.id, m.user_id))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isAdmin && invites.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Link2 className="h-4 w-4" /> 有効な招待リンク（{invites.length}）
          </h4>
          <p className="mb-2 text-[11px] text-muted-foreground">
            リンクを知っている人が誰でも加入できます。1回使うと無効になります。
          </p>
          <ul className="space-y-1.5">
            {invites.map((inv) => (
              <li
                key={inv.token}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                  …{inv.token.slice(-12)}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(inv.expires_at).toLocaleDateString("ja-JP")}まで
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 text-xs"
                  onClick={() => void copyToClipboard(inviteUrl(inv.token))}
                >
                  <Copy className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => run("招待の取り消し", () => revokeInvite(inv.token))}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-border pt-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() =>
            run(
              "脱退",
              async () => {
                await leaveOrganization(org.id, userId);
                toast.success(`「${org.name}」から脱退しました。`);
              },
              onLeft,
            )
          }
        >
          <LogOut className="h-3 w-3" /> この団体から脱退する
        </Button>
        {me?.role === "owner" && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            ※ オーナーが脱退すると、管理できる人がいなくなる場合があります。
          </p>
        )}
      </div>
    </div>
  );
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("招待リンクをコピーしました。相手に共有してください。");
  } catch {
    // 権限が無い・非HTTPSなどでコピーできない場合は、本文で見せて手で取れるようにする
    toast.info(text, { duration: 20000, description: "このリンクを相手に共有してください" });
  }
}
