import { motion } from 'framer-motion'
import { SuitShape } from './Defs.jsx'

const PIPS = {
  2: [[50, 26], [50, 114]],
  3: [[50, 26], [50, 70], [50, 114]],
  4: [[32, 26], [68, 26], [32, 114], [68, 114]],
  5: [[32, 26], [68, 26], [50, 70], [32, 114], [68, 114]],
  6: [[32, 26], [68, 26], [32, 70], [68, 70], [32, 114], [68, 114]],
  7: [[32, 26], [68, 26], [50, 48], [32, 70], [68, 70], [32, 114], [68, 114]],
  8: [[32, 26], [68, 26], [50, 48], [32, 70], [68, 70], [50, 92], [32, 114], [68, 114]],
  9: [[32, 26], [68, 26], [32, 55], [68, 55], [50, 70], [32, 85], [68, 85], [32, 114], [68, 114]],
  10: [[32, 26], [68, 26], [50, 41], [32, 56], [68, 56], [32, 84], [68, 84], [50, 99], [32, 114], [68, 114]]
}

const RANK_LABEL = { A: 'A', K: 'K', Q: 'Q', J: 'J', T: 'T' }
const RANK_NUM = { A: 1, K: 13, Q: 12, J: 11, T: 10 }
const FACE_INK = { s: '#1b2340', c: '#1b3b2c', h: '#8c1c2a', d: '#9a3a12' }

export function parse(code) {
  if (!code || code === '??') return null
  const r = code[0]
  const s = code[1]
  return {
    rank: r,
    suit: s,
    label: RANK_LABEL[r] || r,
    num: RANK_NUM[r] || Number(r),
    red: s === 'h' || s === 'd'
  }
}

function Face({ c }) {
  const color = c.red ? '#b3192b' : '#16181d'
  const pips = PIPS[c.num]
  const court = c.num >= 11
  const ink = FACE_INK[c.suit]
  return (
    <svg viewBox="0 0 100 140" className="card-svg">
      <rect x="0.8" y="0.8" width="98.4" height="138.4" rx="8" fill="url(#cardFace)" stroke="#cfc4ad" strokeWidth="1.2" />
      <g fill={color}>
        <text x="11" y="25" className="card-index" textAnchor="middle" fontSize={c.label === '10' ? 19 : 23}>{c.label}</text>
        <SuitShape suit={c.suit} x={4.5} y={29} size={13} fill={color} />
        <g transform="rotate(180 50 70)">
          <text x="11" y="25" className="card-index" textAnchor="middle" fontSize={c.label === '10' ? 19 : 23}>{c.label}</text>
          <SuitShape suit={c.suit} x={4.5} y={29} size={13} fill={color} />
        </g>
      </g>
      {c.num === 1 && (
        <g>
          <circle cx="50" cy="70" r="27" fill="none" stroke={color} strokeOpacity="0.15" strokeWidth="1" />
          <SuitShape suit={c.suit} x={c.suit === 's' ? 24 : 29} y={c.suit === 's' ? 44 : 49} size={c.suit === 's' ? 52 : 42} fill={color} />
        </g>
      )}
      {pips && pips.map(([x, y], i) => (
        <SuitShape key={i} suit={c.suit} x={x - 9} y={y - 9} size={18} fill={color} rotate={y > 70} />
      ))}
      {court && (
        <g>
          <rect x="22" y="20" width="56" height="100" rx="4" fill={ink} />
          <rect x="25" y="23" width="50" height="94" rx="3" fill="none" stroke="#e8cf8e" strokeWidth="1.2" />
          <path d="M25 70 L75 70" stroke="#e8cf8e" strokeOpacity="0.5" strokeWidth="0.8" />
          <path d="M30 36 L50 28 L70 36 M30 104 L50 112 L70 104" stroke="#e8cf8e" strokeOpacity="0.6" strokeWidth="1" fill="none" />
          <text x="50" y="66" textAnchor="middle" className="card-court" fontSize="30" fill="#f6e7bd">{c.label}</text>
          <g transform="rotate(180 50 70)">
            <text x="50" y="66" textAnchor="middle" className="card-court" fontSize="30" fill="#f6e7bd">{c.label}</text>
          </g>
          <SuitShape suit={c.suit} x={44} y={32} size={12} fill="#e8cf8e" />
          <SuitShape suit={c.suit} x={44} y={96} size={12} fill="#e8cf8e" rotate />
        </g>
      )}
    </svg>
  )
}

export function Back() {
  return (
    <svg viewBox="0 0 100 140" className="card-svg">
      <rect x="0.8" y="0.8" width="98.4" height="138.4" rx="8" fill="#f3ead7" stroke="#cfc4ad" strokeWidth="1.2" />
      <rect x="6" y="6" width="88" height="128" rx="5" fill="url(#cardBack)" />
      <rect x="6" y="6" width="88" height="128" rx="5" fill="url(#backLattice)" />
      <rect x="10" y="10" width="80" height="120" rx="3.5" fill="none" stroke="#e8cf8e" strokeOpacity="0.7" strokeWidth="1.2" />
      <ellipse cx="50" cy="70" rx="21" ry="25" fill="#5a0f1b" stroke="#e8cf8e" strokeWidth="1.4" />
      <text x="50" y="80" textAnchor="middle" className="card-court" fontSize="28" fill="#f0d99a">A</text>
    </svg>
  )
}

export default function Card({ code, w = 80, faceUp = true, glow = false, dim = false, style, initial, animate, delay = 0, className = '' }) {
  const c = parse(code)
  const up = faceUp && !!c
  return (
    <motion.div
      className={`card ${glow ? 'card-glow' : ''} ${dim ? 'card-dim' : ''} ${className}`}
      style={{ width: w, height: w * 1.4, ...style }}
      initial={initial}
      animate={animate || { x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay }}
    >
      <motion.div
        className="card-inner"
        initial={false}
        animate={{ rotateY: up ? 0 : 180 }}
        transition={{ duration: 0.45, ease: [0.3, 0.7, 0.2, 1] }}
      >
        <div className="card-side card-front">{c && <Face c={c} />}</div>
        <div className="card-side card-back"><Back /></div>
      </motion.div>
    </motion.div>
  )
}
