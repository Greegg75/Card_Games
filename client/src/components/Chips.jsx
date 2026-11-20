import { fmt } from '../format.js'

export const DENOMS = [
  { v: 25000, base: '#1d5e8c', edge: '#e9f1f7', ink: '#fff' },
  { v: 5000, base: '#c7582f', edge: '#fff1e6', ink: '#fff' },
  { v: 1000, base: '#c9a55c', edge: '#3a2a10', ink: '#2a1d08' },
  { v: 500, base: '#5b2a86', edge: '#f2e8ff', ink: '#fff' },
  { v: 100, base: '#202128', edge: '#e8cf8e', ink: '#f3ead7' },
  { v: 25, base: '#1f7a4c', edge: '#f3ead7', ink: '#fff' },
  { v: 5, base: '#a3202e', edge: '#f3ead7', ink: '#fff' },
  { v: 1, base: '#e9e2d0', edge: '#3d6fb0', ink: '#1d2a3c' }
]

export const denom = v => DENOMS.find(d => d.v === v) || DENOMS[DENOMS.length - 1]

function short(v) {
  if (v >= 1000) return `${v / 1000}k`
  return String(v)
}

export function Chip({ value, size = 48, label = true }) {
  const d = denom(value)
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="chip-svg">
      <circle cx="50" cy="52" r="47" fill="#000" opacity="0.35" />
      <circle cx="50" cy="50" r="47" fill={d.base} />
      <circle cx="50" cy="50" r="41" fill="none" stroke={d.edge} strokeWidth="11" strokeDasharray="14.5 17.7" transform="rotate(-8 50 50)" />
      <circle cx="50" cy="50" r="47" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="31" fill={d.base} stroke={d.edge} strokeOpacity="0.85" strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="50" cy="50" r="27" fill="#fff" fillOpacity="0.08" />
      {label && (
        <text x="50" y="58" textAnchor="middle" className="chip-label" fill={d.ink} fontSize={value >= 1000 ? 22 : 24}>{short(value)}</text>
      )}
      <ellipse cx="40" cy="28" rx="22" ry="9" fill="#fff" opacity="0.12" />
    </svg>
  )
}

export function breakdown(amount, maxCols = 3, maxPer = 9) {
  const cols = []
  let rest = amount
  for (const d of DENOMS) {
    const n = Math.floor(rest / d.v)
    if (n > 0) {
      cols.push({ d, n: Math.min(n, maxPer) })
      rest -= n * d.v
    }
  }
  return cols.slice(0, maxCols)
}

function StackColumn({ d, n, r }) {
  const ry = r * 0.5
  const th = r * 0.24
  const w = r * 2 + 4
  const h = ry * 2 + th * n + 4
  const cx = r + 2
  const items = []
  for (let i = 0; i < n; i++) {
    const cy = h - ry - 2 - th - i * th
    items.push(
      <g key={i}>
        <path d={`M${cx - r} ${cy} v${th} a${r} ${ry} 0 0 0 ${2 * r} 0 v${-th} Z`} fill={d.base} />
        <path d={`M${cx - r} ${cy} v${th} a${r} ${ry} 0 0 0 ${2 * r} 0 v${-th} Z`} fill="#000" opacity="0.28" />
        <path
          d={`M${cx - r} ${cy + th / 2} a${r} ${ry} 0 0 0 ${2 * r} 0`}
          fill="none"
          stroke={d.edge}
          strokeWidth={th * 0.7}
          strokeDasharray={`${r * 0.32} ${r * 0.4}`}
        />
        <ellipse cx={cx} cy={cy} rx={r} ry={ry} fill={d.base} />
        <ellipse cx={cx} cy={cy} rx={r * 0.86} ry={ry * 0.86} fill="none" stroke={d.edge} strokeWidth={r * 0.2} strokeDasharray={`${r * 0.3} ${r * 0.38}`} />
        <ellipse cx={cx} cy={cy} rx={r * 0.58} ry={ry * 0.58} fill={d.base} stroke={d.edge} strokeOpacity="0.7" strokeWidth="0.8" />
        <ellipse cx={cx - r * 0.2} cy={cy - ry * 0.3} rx={r * 0.5} ry={ry * 0.25} fill="#fff" opacity="0.1" />
      </g>
    )
  }
  return (
    <svg width={w} height={h} className="stack-col" style={{ marginTop: 'auto' }}>
      <ellipse cx={cx} cy={h - ry} rx={r} ry={ry} fill="#000" opacity="0.35" />
      {items}
    </svg>
  )
}

export function ChipStack({ amount, r = 16, showLabel = true, className = '' }) {
  if (!amount) return null
  const cols = breakdown(amount)
  return (
    <div className={`chipstack ${className}`}>
      <div className="chipstack-cols">
        {cols.map((c, i) => <StackColumn key={i} d={c.d} n={c.n} r={r} />)}
      </div>
      {showLabel && <div className="chipstack-label">{fmt(amount)}</div>}
    </div>
  )
}
