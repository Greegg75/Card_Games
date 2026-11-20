import { SuitShape } from './Defs.jsx'

const T = { x: 170, y: 140, w: 1260, h: 600 }

function stadium(inset, dy = 0) {
  const x = T.x + inset
  const y = T.y + inset + dy
  const w = T.w - inset * 2
  const h = T.h - inset * 2
  return { x, y, width: w, height: h, rx: h / 2 }
}

export default function PokerFelt({ theme = 'emerald', title }) {
  const felt = stadium(50)
  const clipId = `feltClip-${theme}`
  return (
    <svg className="felt-svg" viewBox="0 0 1600 960" width="1600" height="960">
      <defs>
        <clipPath id={clipId}><rect {...felt} /></clipPath>
      </defs>
      <ellipse cx="800" cy="500" rx="700" ry="340" fill="#000" opacity="0.6" filter="url(#softShadow)" />
      <rect {...stadium(0, 26)} fill="url(#leatherSide)" />
      <rect {...stadium(0, 13)} fill="#0b0604" />
      <rect {...stadium(0)} fill="url(#leather)" />
      <rect {...stadium(0)} fill="url(#railSheen)" />
      <rect {...stadium(2)} fill="none" stroke="#fff" strokeOpacity="0.09" strokeWidth="2" />
      <rect {...stadium(17)} fill="none" stroke="#e8cf8e" strokeOpacity="0.32" strokeWidth="1.6" strokeDasharray="7 6" />
      <rect {...stadium(33)} fill="none" stroke="#e8cf8e" strokeOpacity="0.32" strokeWidth="1.6" strokeDasharray="7 6" />
      <rect {...stadium(44)} fill="none" stroke="url(#brass)" strokeWidth="9" />
      <rect {...stadium(44)} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth="1" />
      <rect {...felt} fill={`url(#felt-${theme})`} />
      <g clipPath={`url(#${clipId})`}>
        <rect {...felt} filter="url(#feltNoise)" opacity="0.5" style={{ mixBlendMode: 'multiply' }} />
        <rect {...stadium(50)} fill="none" stroke="#000" strokeOpacity="0.55" strokeWidth="26" filter="url(#innerShade)" />
        <rect {...stadium(122)} fill="none" stroke="#fff" strokeOpacity="0.13" strokeWidth="2.5" />
        <rect {...stadium(128)} fill="none" stroke="#fff" strokeOpacity="0.06" strokeWidth="1" />
        <g opacity="0.1" fill="#fff">
          <SuitShape suit="s" x={706} y={530} size={28} fill="#fff" />
          <SuitShape suit="h" x={746} y={530} size={28} fill="#fff" />
          <SuitShape suit="d" x={786} y={530} size={28} fill="#fff" />
          <SuitShape suit="c" x={826} y={530} size={28} fill="#fff" />
          <text x="800" y="606" textAnchor="middle" className="felt-brand">Aurum Club</text>
          {title && <text x="800" y="636" textAnchor="middle" className="felt-sub">{title}</text>}
        </g>
        <rect {...felt} fill="url(#spot)" />
        <rect {...felt} fill="url(#vignette)" />
      </g>
      <g opacity="0.16">
        {[0, 1, 2, 3, 4].map(i => (
          <rect key={i} x={575 + i * 92} y={370} width={82} height={115} rx={8} fill="none" stroke="#fff" strokeWidth="1.5" strokeDasharray="5 5" />
        ))}
      </g>
    </svg>
  )
}

export function MiniTable({ theme = 'emerald', seats = 6, players = 0, game = 'poker' }) {
  const pts = Array.from({ length: seats }, (_, i) => {
    if (game === 'blackjack') {
      const a = (56 - (112 / (seats - 1)) * i) * Math.PI / 180
      return [100 + 78 * Math.sin(a), 22 + 70 * Math.cos(a)]
    }
    const t = (2 * Math.PI * i) / seats
    return [100 - 88 * Math.sin(t), 60 + 46 * Math.cos(t)]
  })
  return (
    <svg viewBox="0 0 200 120" className="mini-table">
      {game === 'blackjack' ? (
        <g>
          <path d="M14 18 L186 18 A 86 84 0 0 1 14 18 Z" fill="url(#leather)" />
          <path d="M24 18 L176 18 A 76 74 0 0 1 24 18 Z" fill={`url(#felt-${theme})`} stroke="url(#brass)" strokeWidth="2" />
        </g>
      ) : (
        <g>
          <rect x="10" y="16" width="180" height="88" rx="44" fill="url(#leather)" />
          <rect x="18" y="24" width="164" height="72" rx="36" fill={`url(#felt-${theme})`} stroke="url(#brass)" strokeWidth="2" />
        </g>
      )}
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="6.5" fill={i < players ? '#e8cf8e' : '#0d1613'} stroke="#e8cf8e" strokeOpacity={i < players ? 1 : 0.45} strokeWidth="1.5" />
      ))}
    </svg>
  )
}
