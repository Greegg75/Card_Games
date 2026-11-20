import { THEMES } from '../format.js'

export const SUIT_PATHS = {
  h: 'M50 92 C 22 70 2 50 2 30 C 2 13 14 3 28 3 C 38 3 46 9 50 19 C 54 9 62 3 72 3 C 86 3 98 13 98 30 C 98 50 78 70 50 92 Z',
  d: 'M50 2 Q 66 28 90 50 Q 66 72 50 98 Q 34 72 10 50 Q 34 28 50 2 Z',
  s: 'M50 3 C 62 22 98 40 98 62 C 98 78 86 86 74 86 C 64 86 57 81 53 74 C 54 84 58 92 67 98 L 33 98 C 42 92 46 84 47 74 C 43 81 36 86 26 86 C 14 86 2 78 2 62 C 2 40 38 22 50 3 Z'
}

export function SuitShape({ suit, x = 0, y = 0, size = 100, fill, rotate = false }) {
  const s = size / 100
  const t = rotate
    ? `translate(${x + size} ${y + size}) rotate(180) scale(${s})`
    : `translate(${x} ${y}) scale(${s})`
  if (suit === 'c') {
    return (
      <g transform={t} fill={fill}>
        <circle cx="50" cy="27" r="23" />
        <circle cx="25" cy="60" r="23" />
        <circle cx="75" cy="60" r="23" />
        <circle cx="50" cy="55" r="12" />
        <path d="M45 58 C 45 80 40 91 30 98 L 70 98 C 60 91 55 80 55 58 Z" />
      </g>
    )
  }
  return <path transform={t} d={SUIT_PATHS[suit]} fill={fill} />
}

export default function Defs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="cardFace" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fffdf7" />
          <stop offset="1" stopColor="#efe7d6" />
        </linearGradient>
        <linearGradient id="cardBack" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a2534" />
          <stop offset="0.55" stopColor="#6d1522" />
          <stop offset="1" stopColor="#470b15" />
        </linearGradient>
        <pattern id="backLattice" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 5 H10 M5 0 V10" stroke="#e8cf8e" strokeOpacity="0.22" strokeWidth="1.2" />
          <circle cx="5" cy="5" r="1.4" fill="#e8cf8e" fillOpacity="0.35" />
        </pattern>
        <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4e2a6" />
          <stop offset="0.45" stopColor="#c9a55c" />
          <stop offset="0.55" stopColor="#9c7a37" />
          <stop offset="1" stopColor="#e3c47c" />
        </linearGradient>
        <linearGradient id="brassH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a6a2e" />
          <stop offset="0.5" stopColor="#f0d99a" />
          <stop offset="1" stopColor="#8a6a2e" />
        </linearGradient>
        <linearGradient id="leather" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a3826" />
          <stop offset="0.18" stopColor="#3b2316" />
          <stop offset="0.6" stopColor="#21130b" />
          <stop offset="1" stopColor="#120a05" />
        </linearGradient>
        <linearGradient id="leatherSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a0f08" />
          <stop offset="1" stopColor="#050302" />
        </linearGradient>
        <radialGradient id="railSheen" cx="0.5" cy="0" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.04" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {Object.entries(THEMES).map(([id, t]) => (
          <radialGradient key={id} id={`felt-${id}`} cx="0.5" cy="0.42" r="0.68">
            <stop offset="0" stopColor={t.felt[0]} />
            <stop offset="0.62" stopColor={t.felt[1]} />
            <stop offset="1" stopColor={t.felt[2]} />
          </radialGradient>
        ))}
        <radialGradient id="spot" cx="0.5" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#fff6dc" stopOpacity="0.2" />
          <stop offset="0.6" stopColor="#fff6dc" stopOpacity="0.03" />
          <stop offset="1" stopColor="#fff6dc" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.62">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </radialGradient>
        <filter id="feltNoise" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
        </filter>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
        <filter id="innerShade" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
    </svg>
  )
}
