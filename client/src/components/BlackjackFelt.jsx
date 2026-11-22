import { DENOMS } from './Chips.jsx'

export const BJ_O = { x: 800, y: 110 }
export const SPOT_ANGLES = [56, 28, 0, -28, -56]

export function spotXY(i) {
  const a = (SPOT_ANGLES[i] * Math.PI) / 180
  return { x: BJ_O.x + 520 * Math.sin(a), y: BJ_O.y + 500 * Math.cos(a) }
}

export function towardCenter(p, dist) {
  const dx = BJ_O.x - p.x
  const dy = BJ_O.y - p.y
  const l = Math.hypot(dx, dy)
  return { x: p.x + (dx / l) * dist, y: p.y + (dy / l) * dist }
}

function Rack() {
  const cols = DENOMS.slice(-8).reverse()
  return (
    <g>
      <rect x="590" y="20" width="420" height="78" rx="10" fill="#120b06" stroke="url(#brass)" strokeWidth="3" />
      {cols.map((d, i) => (
        <g key={d.v}>
          <rect x={604 + i * 50} y={30} width={42} height={58} rx={21} fill="#060403" />
          {[0, 1, 2, 3, 4, 5, 6].map(k => (
            <g key={k}>
              <rect x={606 + i * 50} y={34 + k * 7.4} width={38} height={6.4} rx={2.5} fill={d.base} />
              <rect x={606 + i * 50 + 8} y={34 + k * 7.4} width={6} height={6.4} fill={d.edge} opacity="0.85" />
              <rect x={606 + i * 50 + 24} y={34 + k * 7.4} width={6} height={6.4} fill={d.edge} opacity="0.85" />
            </g>
          ))}
        </g>
      ))}
    </g>
  )
}

function Shoe() {
  return (
    <g transform="translate(1250 150) rotate(-14)">
      <rect x="0" y="0" width="150" height="96" rx="10" fill="#0c0806" />
      <rect x="4" y="4" width="142" height="88" rx="8" fill="url(#leather)" stroke="url(#brass)" strokeWidth="2.5" />
      <rect x="18" y="22" width="96" height="52" rx="4" fill="#5a0f1b" />
      <rect x="18" y="22" width="96" height="52" rx="4" fill="url(#backLattice)" />
      <path d="M114 22 L140 30 L140 66 L114 74 Z" fill="#1c120c" stroke="url(#brass)" strokeWidth="1.5" />
    </g>
  )
}

export default function BlackjackFelt({ theme = 'crimson' }) {
  const outer = 'M110 110 L1490 110 A 690 670 0 0 1 110 110 Z'
  const felt = 'M170 110 L1430 110 A 630 610 0 0 1 170 110 Z'
  return (
    <svg className="felt-svg" viewBox="0 0 1600 960" width="1600" height="960">
      <defs>
        <clipPath id="bjFeltClip"><path d={felt} /></clipPath>
        <path id="bjArc1" d="M492 110 A 308 300 0 0 0 1108 110" />
        <path id="bjArc2" d="M562 110 A 238 232 0 0 0 1038 110" />
        <path id="bjArc3" d="M508 110 A 292 284 0 0 0 1092 110" />
      </defs>
      <ellipse cx="800" cy="520" rx="720" ry="300" fill="#000" opacity="0.55" filter="url(#softShadow)" />
      <path d={outer} transform="translate(0 26)" fill="url(#leatherSide)" />
      <path d={outer} transform="translate(0 12)" fill="#0b0604" />
      <path d={outer} fill="url(#leather)" />
      <path d={outer} fill="url(#railSheen)" />
      <path d="M128 110 A 672 652 0 0 0 1472 110" fill="none" stroke="#e8cf8e" strokeOpacity="0.3" strokeWidth="1.6" strokeDasharray="7 6" />
      <path d="M152 110 A 648 628 0 0 0 1448 110" fill="none" stroke="#e8cf8e" strokeOpacity="0.3" strokeWidth="1.6" strokeDasharray="7 6" />
      <path d="M166 110 A 634 614 0 0 0 1434 110" fill="none" stroke="url(#brass)" strokeWidth="9" />
      <path d={felt} fill={`url(#felt-${theme})`} />
      <g clipPath="url(#bjFeltClip)">
        <path d={felt} filter="url(#feltNoise)" opacity="0.5" style={{ mixBlendMode: 'multiply' }} />
        <path d={felt} fill="none" stroke="#000" strokeOpacity="0.5" strokeWidth="28" filter="url(#innerShade)" />
        <ellipse cx="800" cy="110" rx="760" ry="420" fill="url(#spot)" />
        <g className="bj-print">
          <text fontSize="26" letterSpacing="3"><textPath href="#bjArc3" startOffset="50%" textAnchor="middle">Le blackjack paie 3 pour 2</textPath></text>
          <text fontSize="19" letterSpacing="2" opacity="0.8"><textPath href="#bjArc2" startOffset="50%" textAnchor="middle">La banque tire jusqu'à 16 et reste à 17</textPath></text>
        </g>
        <path d="M470 110 A 330 320 0 0 0 1130 110" fill="none" stroke="#fff" strokeOpacity="0.12" strokeWidth="2" />
        <path d={felt} fill="url(#vignette)" />
      </g>
      <rect x="96" y="96" width="1408" height="20" rx="6" fill="#140c07" />
      <rect x="96" y="96" width="1408" height="6" rx="3" fill="url(#brassH)" opacity="0.9" />
      <Rack />
      <Shoe />
      <g opacity="0.5">
        <rect x="180" y="150" width="90" height="120" rx="8" fill="none" stroke="#fff" strokeOpacity="0.35" strokeDasharray="5 5" transform="rotate(12 225 210)" />
      </g>
      {SPOT_ANGLES.map((_, i) => {
        const p = spotXY(i)
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="54" fill="#000" fillOpacity="0.12" stroke="url(#brass)" strokeWidth="3" />
            <circle cx={p.x} cy={p.y} r="45" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" />
          </g>
        )
      })}
    </svg>
  )
}
