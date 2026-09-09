// 未ログイン時のお気に入り・自分の登録はこの端末のブラウザにだけ残る。
// ログインするとクラウド（DB）に移行するので、読み書きの入口をここに集約する。
import type { Grant } from "@/lib/grants-data";

const FAV_STORAGE_KEY = "tsunagu-josei:favorites:v1";
const CUSTOM_STORAGE_KEY = "tsunagu-josei:custom:v1";

export type LocalData = {
  favorites: string[];
  customs: Grant[];
};

const EMPTY: LocalData = { favorites: [], customs: [] };

function readJson<T>(key: string, isValid: (v: unknown) => v is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    // プライベートブラウズや壊れたJSONなど。保存が使えないだけで機能は続行する。
    return null;
  }
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");
const isGrantArray = (v: unknown): v is Grant[] =>
  Array.isArray(v) && v.every((x) => typeof x === "object" && x !== null && "id" in x);

export function readLocalData(): LocalData {
  if (typeof window === "undefined") return EMPTY;
  return {
    favorites: readJson(FAV_STORAGE_KEY, isStringArray) ?? [],
    customs: (readJson(CUSTOM_STORAGE_KEY, isGrantArray) ?? []).map((g) => ({
      ...g,
      custom: true,
    })),
  };
}

export function writeLocalFavorites(ids: string[]): void {
  try {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* 保存できなくても操作自体は続けられる */
  }
}

export function writeLocalCustoms(list: Grant[]): void {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* 同上 */
  }
}

// 移行が完全に成功したときだけ呼ぶ。失敗時に消すと手元のデータが失われる。
export function clearLocalData(): void {
  try {
    localStorage.removeItem(FAV_STORAGE_KEY);
    localStorage.removeItem(CUSTOM_STORAGE_KEY);
  } catch {
    /* 消せなくても、次回の移行は重複を作らないので実害はない */
  }
}
