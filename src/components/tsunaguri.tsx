// つなぐり — つなぐ助成のキャラクター。
//
// どんぐり＝助成金という「小さな種」。それがNPOの活動として芽吹き、木に育つ。
// 頭の双葉がその芽で、表情と一緒に育ったり縮んだりする。
//
// 色は styles.css のトークンを参照するので、ライト／ダークどちらでも成立する。
// 画像ファイルを持たないぶんリポジトリが軽く、拡大しても粗くならない。
import { cn } from "@/lib/utils";

export type TsunaguriMood =
  | "default" // 基本
  | "searching" // 検索中
  | "thinking" // 該当なし
  | "hurry" // 締切間近
  | "sleeping" // 受付終了
  | "happy" // お気に入り追加・成功
  | "seed"; // まだ何も無い（土の上の種）

const CAP = "oklch(from var(--secondary) l c h)";
const NUT = "var(--warm)";
const LEAF = "var(--leaf)";
const INK = "var(--foreground)";
// 汗だけは暖色パレットに無い色。緑にすると葉と見分けがつかない。
const SWEAT = "oklch(0.72 0.1 230)";

/** 実と帽子。どの表情でも共通の土台。 */
function Body({ capTilt = 0 }: { capTilt?: number }) {
  return (
    <>
      <path d="M17 27 C17 45 23 56 32 59 C41 56 47 45 47 27 Z" fill={NUT} />
      {/* 実のつや。左上に寄せると丸みが出る */}
      <ellipse cx="24" cy="36" rx="3.2" ry="5" fill="var(--card)" opacity="0.35" />
      <g transform={`rotate(${capTilt} 32 26)`}>
        <path
          d="M14 28 C14 16.5 22 10 32 10 C42 10 50 16.5 50 28 C50 29.1 49.1 30 48 30 L16 30 C14.9 30 14 29.1 14 28 Z"
          fill={CAP}
        />
        {/* 殻斗のざらつき */}
        <g opacity="0.25" fill="var(--foreground)">
          <circle cx="23" cy="21" r="1.1" />
          <circle cx="31" cy="17.5" r="1.1" />
          <circle cx="39" cy="21" r="1.1" />
          <circle cx="27" cy="26" r="1.1" />
          <circle cx="37" cy="26" r="1.1" />
        </g>
      </g>
    </>
  );
}

/** 頭の双葉。grown で伸びた状態になる。 */
function Sprout({ grown = false }: { grown?: boolean }) {
  const scale = grown ? 1.25 : 1;
  return (
    <g transform={`translate(32 10) scale(${scale}) translate(-32 -10)`}>
      <rect x="30.8" y="3" width="2.4" height="8" rx="1.2" fill={LEAF} />
      <ellipse cx="27" cy="4.5" rx="4.2" ry="2.6" fill={LEAF} transform="rotate(-22 27 4.5)" />
      <ellipse cx="37" cy="4.5" rx="4.2" ry="2.6" fill={LEAF} transform="rotate(22 37 4.5)" />
    </g>
  );
}

function Eyes({ look = 0 }: { look?: number }) {
  return (
    <g fill={INK}>
      <circle cx={26 + look} cy="38" r="2.1" />
      <circle cx={38 + look} cy="38" r="2.1" />
    </g>
  );
}

function ClosedEyes({ happy = false }: { happy?: boolean }) {
  const d = happy
    ? ["M23.5 38.5 Q26 35.5 28.5 38.5", "M35.5 38.5 Q38 35.5 40.5 38.5"]
    : ["M23.5 38 Q26 40.5 28.5 38", "M35.5 38 Q38 40.5 40.5 38"];
  return (
    <g stroke={INK} strokeWidth="1.8" strokeLinecap="round" fill="none">
      <path d={d[0]} />
      <path d={d[1]} />
    </g>
  );
}

function Mouth({ d }: { d: string }) {
  return <path d={d} stroke={INK} strokeWidth="1.6" strokeLinecap="round" fill="none" />;
}

export function Tsunaguri({
  mood = "default",
  className,
  label,
}: {
  mood?: TsunaguriMood;
  className?: string;
  /** 読み上げ用。省略すると装飾扱い（隣に文言がある場合はこちら）。 */
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 68"
      className={cn("h-16 w-16", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {mood === "seed" ? <SeedScene /> : <MoodScene mood={mood} />}
    </svg>
  );
}

function MoodScene({ mood }: { mood: Exclude<TsunaguriMood, "seed"> }) {
  switch (mood) {
    case "searching":
      return (
        <>
          <Sprout />
          <Body />
          <Eyes look={2} />
          <Mouth d="M29 45 Q32 47.5 35 45" />
          {/* 虫めがね。右手で持っている想定 */}
          <g stroke={CAP} strokeWidth="2.4" fill="none">
            <circle cx="47" cy="45" r="6.5" fill="var(--card)" opacity="0.9" />
            <circle cx="47" cy="45" r="6.5" />
            <path d="M51.8 49.8 L56 54" strokeLinecap="round" />
          </g>
        </>
      );

    case "thinking":
      return (
        <>
          <Sprout />
          <Body capTilt={-9} />
          <Eyes />
          <Mouth d="M28.5 45.5 Q32 43.5 35.5 45.5" />
          <g fill={INK} opacity="0.55">
            <circle cx="50" cy="20" r="1.5" />
            <circle cx="55" cy="17" r="2.1" />
            <circle cx="60" cy="13" r="2.8" />
          </g>
        </>
      );

    case "hurry":
      return (
        <>
          <Sprout />
          <Body capTilt={7} />
          <Eyes />
          {/* 開いた口 */}
          <ellipse cx="32" cy="46" rx="3.2" ry="4" fill={INK} />
          {/* 汗 */}
          <path d="M47 33 Q49.5 37 47 39 Q44.5 37 47 33 Z" fill={SWEAT} />
          {/* いそいでいる線 */}
          <g stroke={INK} strokeWidth="1.8" strokeLinecap="round" opacity="0.5">
            <path d="M6 32 H12" />
            <path d="M4 38 H11" />
            <path d="M6 44 H12" />
          </g>
        </>
      );

    case "sleeping":
      return (
        <>
          <Sprout />
          {/* 帽子を目深に */}
          <g transform="translate(0 3)">
            <Body />
          </g>
          <g transform="translate(0 3)">
            <ClosedEyes />
            <Mouth d="M29.5 46 Q32 47.5 34.5 46" />
          </g>
          <g fill={INK} opacity="0.4" fontSize="9" fontWeight="700">
            <text x="48" y="20">
              z
            </text>
            <text x="54" y="13">
              z
            </text>
          </g>
        </>
      );

    case "happy":
      return (
        <>
          <Sprout grown />
          <Body />
          <ClosedEyes happy />
          <Mouth d="M28 44.5 Q32 48.5 36 44.5" />
          {/* ほっぺ */}
          <g fill="var(--secondary)" opacity="0.45">
            <ellipse cx="22.5" cy="43" rx="2.6" ry="1.8" />
            <ellipse cx="41.5" cy="43" rx="2.6" ry="1.8" />
          </g>
        </>
      );

    default:
      return (
        <>
          <Sprout />
          <Body />
          <Eyes />
          <Mouth d="M29 45 Q32 47.5 35 45" />
        </>
      );
  }
}

/** まだ何も無い状態。土に埋まった種として描く。 */
function SeedScene() {
  return (
    <>
      <g transform="translate(7 12) scale(0.78)">
        <Sprout />
        <Body />
        <ClosedEyes />
        <Mouth d="M30 45.5 Q32 46.8 34 45.5" />
      </g>
      {/* 土 */}
      <path d="M4 60 Q32 53 60 60 L60 68 L4 68 Z" fill="var(--muted)" />
      <g fill={INK} opacity="0.18">
        <circle cx="14" cy="63" r="1.4" />
        <circle cx="32" cy="61.5" r="1.2" />
        <circle cx="50" cy="63" r="1.4" />
      </g>
    </>
  );
}

/** 団体アカウント用。根でつながった3つ。 */
export function TsunaguriGroup({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 132 68"
      className={cn("h-16 w-32", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* 根。ばらばらの個人ではなく、地下でつながっていることを示す */}
      <g stroke={LEAF} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.65">
        <path d="M24 58 Q40 66 66 60 Q92 66 108 58" />
        <path d="M66 60 V66" />
      </g>
      <g transform="translate(-8 8) scale(0.72)">
        <Sprout />
        <Body capTilt={-6} />
        <ClosedEyes happy />
        <Mouth d="M29 45 Q32 47.5 35 45" />
      </g>
      <g transform="translate(34 0)">
        <Sprout />
        <Body />
        <ClosedEyes happy />
        <Mouth d="M28 44.5 Q32 48.5 36 44.5" />
      </g>
      <g transform="translate(76 8) scale(0.72)">
        <Sprout />
        <Body capTilt={6} />
        <ClosedEyes happy />
        <Mouth d="M29 45 Q32 47.5 35 45" />
      </g>
    </svg>
  );
}
