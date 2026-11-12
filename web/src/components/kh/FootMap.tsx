import { SITES, tenth, THRESH } from '@/lib/rules/rules';
import { cn } from '@/lib/cn';

/**
 * Both feet seen from above, 4 sensor sites each (hallux, MTH1, MTH5, heel).
 * The patient's right foot is drawn on the right of the screen. Values are °C;
 * 0 = no reading yet, ≤ -100 or 85 = faulty sensor. A site is highlighted when the
 * difference at that site is above the threshold and this foot is the warmer one.
 */
const FOOT_PATH =
  'M52 236C30 236 22 220 24 200C26 180 30 160 28 140C26 118 20 100 21 80C22 60 28 44 40 36C50 30 64 32 72 42C82 56 82 80 80 100C78 125 74 150 76 175C78 200 78 236 52 236Z';
const TOES: [number, number, number, number][] = [
  [35, 22, 11, 13],
  [53, 15, 6.5, 8],
  [64.5, 19.5, 5.8, 7],
  [73.5, 28.5, 5.2, 6.4],
  [80, 41, 4.6, 5.6],
];
/** Site centres in right-foot coordinates (inner edge on the left). */
const SITE_XY: [number, number][] = [
  [35, 24],
  [36, 76],
  [70, 90],
  [51, 200],
];

const isFault = (v: number | undefined) => v === undefined || !Number.isFinite(v) || v <= -100 || v === 85;

export function FootMap({
  L,
  R,
  showValues = true,
  className,
  highlight = 'auto',
  compact = false,
}: {
  L?: number[] | null;
  R?: number[] | null;
  showValues?: boolean;
  className?: string;
  /** 'auto' = from the difference, or an explicit list of flagged sites per foot. */
  highlight?: 'auto' | { L: number[]; R: number[] };
  compact?: boolean;
}) {
  const hot = (foot: 'L' | 'R', i: number) => {
    if (highlight !== 'auto') return highlight[foot].includes(i);
    const l = L?.[i];
    const r = R?.[i];
    if (isFault(l) || isFault(r) || !l || !r) return false;
    const d = r - l;
    return Math.abs(d) > THRESH && (foot === 'R' ? d > 0 : d < 0);
  };
  const label = (v: number | undefined) =>
    v === undefined || v === 0 ? '—' : isFault(v) ? 'عطل' : tenth(v).toFixed(1);

  const foot = (side: 'L' | 'R') => {
    const vals = side === 'L' ? L : R;
    const tx = side === 'R' ? 'translate(146 8)' : 'translate(114 8) scale(-1 1)';
    return (
      <g key={side}>
        <g transform={tx}>
          <path d={FOOT_PATH} fill="var(--kh-brand-50)" stroke="var(--kh-brand-300)" strokeWidth="2" />
          {TOES.map(([cx, cy, rx, ry], k) => (
            <ellipse
              key={k}
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="var(--kh-brand-50)"
              stroke="var(--kh-brand-300)"
              strokeWidth="2"
            />
          ))}
          {SITE_XY.map(([x, y], i) => {
            const h = hot(side, i);
            const fault = isFault(vals?.[i]) && vals?.[i] !== undefined;
            return (
              <g key={i}>
                {h && (
                  <circle
                    cx={x}
                    cy={y}
                    r="17"
                    fill="var(--kh-orange)"
                    opacity=".22"
                    className="animate-soft-pulse"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r="9.5"
                  fill={h ? 'var(--kh-orange)' : fault ? 'var(--kh-none-soft)' : 'var(--kh-brand-700)'}
                  stroke={fault ? 'var(--kh-none)' : '#fff'}
                  strokeWidth="2.5"
                  strokeDasharray={fault ? '3 2' : undefined}
                />
              </g>
            );
          })}
        </g>
        {showValues &&
          vals?.some((v) => v !== 0) &&
          SITE_XY.map(([x, y], i) => {
            const sx = side === 'R' ? 146 + x : 114 - x;
            return (
              <text
                key={i}
                x={sx}
                y={y + 8 + 22}
                textAnchor="middle"
                fontSize="14"
                fontWeight="600"
                fill={hot(side, i) ? 'var(--kh-orange-ink)' : 'var(--kh-ink-2)'}
                direction="ltr"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {label(vals?.[i])}
              </text>
            );
          })}
        <text
          x={side === 'R' ? 198 : 62}
          y="268"
          textAnchor="middle"
          fontSize="15"
          fontWeight="600"
          fill="var(--kh-mute)"
        >
          {side === 'R' ? 'اليمنى' : 'اليسرى'}
        </text>
      </g>
    );
  };

  const desc = SITES.map((s, i) => `${s.ar}: يسار ${label(L?.[i])}، يمين ${label(R?.[i])}`).join('. ');
  return (
    <svg
      viewBox="0 0 260 276"
      className={cn('mx-auto w-full', compact ? 'max-w-[260px]' : 'max-w-[320px]', className)}
      role="img"
      aria-label={`خريطة القدمين. ${desc}`}
    >
      {foot('L')}
      {foot('R')}
    </svg>
  );
}
