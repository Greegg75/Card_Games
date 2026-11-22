import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { send, useStore } from '../net.js'
import { fmt, range } from '../format.js'
import Card from '../components/Card.jsx'
import { Chip, ChipStack, DENOMS } from '../components/Chips.jsx'
import BlackjackFelt, { spotXY, towardCenter } from '../components/BlackjackFelt.jsx'
import { Avatar, Balance, SidePanel, Stage, leaveTable, useCountdown } from '../components/Common.jsx'

const SHOE = { x: 1320, y: 200 }
const DEALER = { x: 800, y: 205 }

function resultKind(r) {
  if (r === 'Blackjack') return 'bj'
  if (r === 'Gagné') return 'win'
  if (r === 'Égalité') return 'push'
  return 'lose'
}

function HandStack({ hand, base, active, roundNo, seatIndex, handIndex }) {
  const w = 72
  return (
    <div className={`bj-hand ${active ? 'bj-hand-active' : ''}`} style={{ left: base.x, top: base.y }}>
      {hand.cards.map((c, i) => (
        <Card
          key={`${roundNo}-${seatIndex}-${handIndex}-${i}`}
          code={c}
          w={w}
          style={{ position: 'absolute', left: -w / 2 + i * 22, top: -w * 0.7 - i * 18 }}
          initial={{ x: SHOE.x - base.x - i * 22, y: SHOE.y - base.y + i * 18, opacity: 0, rotate: 40, scale: 0.6 }}
          delay={i < 2 ? i * 0.35 + seatIndex * 0.08 : 0}
        />
      ))}
      {hand.cards.length > 0 && (
        <div className="bj-value" style={{ left: hand.cards.length * 22 - 6, top: -w * 0.7 - hand.cards.length * 18 - 6 }}>
          {hand.value === 'BJ' ? 'Blackjack' : hand.value}
        </div>
      )}
      <AnimatePresence>
        {hand.result && (
          <motion.div className={`bj-result bj-result-${resultKind(hand.result)}`} style={{ x: '-50%' }} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            {hand.result}{hand.payout > 0 && hand.result !== 'Égalité' ? ` +${fmt(hand.payout)}` : ''}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BjSeat({ v, i, progress }) {
  const s = v.seats[i]
  const spot = spotXY(i)
  const plate = towardCenter(spot, -118)
  const isYou = v.you === i
  const isTurn = v.turn_seat === i
  if (!s) {
    return (
      <div className="bj-spot" style={{ left: spot.x, top: spot.y }}>
        {v.you == null && (
          <button className="seat-sit seat-sit-bj" onClick={() => send({ t: 'sit', seat: i })}>
            <span className="seat-sit-plus">+</span>
            <span>S'asseoir</span>
          </button>
        )}
      </div>
    )
  }
  const hands = s.hands
  const spread = 118
  return (
    <>
      <div className="bj-spot" style={{ left: spot.x, top: spot.y }}>
        {s.bet > 0 && <ChipStack amount={s.bet} r={17} />}
        {hands.length > 0 && <ChipStack amount={hands.reduce((a, h) => a + h.bet, 0)} r={17} />}
      </div>
      {hands.map((h, hi) => {
        const c = towardCenter(spot, 125)
        const offset = (hi - (hands.length - 1) / 2) * spread
        return (
          <HandStack
            key={hi}
            hand={h}
            base={{ x: c.x + offset, y: c.y }}
            active={isTurn && v.turn_hand === hi}
            roundNo={v.round_no}
            seatIndex={i}
            handIndex={hi}
          />
        )
      })}
      <div className={`seat bj-seat ${isYou ? 'seat-you' : ''}`} style={{ left: plate.x, top: plate.y }}>
        <Avatar name={s.name} size={isYou ? 76 : 66} progress={isTurn ? progress : null} active={isTurn} dim={s.leaving} />
        <div className={`plate ${isTurn ? 'plate-active' : ''}`}>
          <div className="plate-name">{s.name}</div>
          <div className="plate-stack">{s.last_bet ? `Mise ${fmt(s.last_bet)}` : isYou ? 'Vous' : 'Assis'}</div>
        </div>
      </div>
    </>
  )
}

function BetBar({ v, remaining }) {
  const balance = useStore(s => s.balance)
  const me = v.seats[v.you]
  const chips = DENOMS.map(d => d.v).filter(x => x <= v.table.max_bet && x * 20 >= v.table.min_bet).reverse().slice(0, 6)
  const bet = amount => send({ t: 'bet', amount })
  return (
    <motion.div className="bj-bar" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
      <div className="bj-bar-info">
        <strong>{me.bet > 0 ? `Votre mise : ${fmt(me.bet)}` : 'Placez votre mise'}</strong>
        <span>
          {v.phase === 'betting' && remaining != null ? `Distribution dans ${Math.ceil(remaining / 1000)} s` : `Mise ${range(v.table.min_bet, v.table.max_bet)}`}
        </span>
      </div>
      <div className="bj-chips">
        {chips.map(c => (
          <button key={c} className="chip-btn" disabled={balance < c || me.bet + c > v.table.max_bet} onClick={() => bet(c)} aria-label={`Miser ${c}`}>
            <Chip value={c} size={58} />
          </button>
        ))}
      </div>
      <div className="bj-bar-actions">
        <button className="btn btn-ghost btn-sm" disabled={!me.bet} onClick={() => send({ t: 'act', kind: 'clear' })}>Effacer</button>
        <button className="btn btn-ghost btn-sm" disabled={!me.last_bet || me.bet > 0} onClick={() => send({ t: 'act', kind: 'rebet' })}>Remiser {me.last_bet ? fmt(me.last_bet) : ''}</button>
      </div>
    </motion.div>
  )
}

function PlayBar({ v }) {
  const act = kind => send({ t: 'act', kind })
  useEffect(() => {
    const k = e => {
      if (e.target.tagName === 'INPUT') return
      if (e.key === 'h') act('hit')
      if (e.key === 's') act('stand')
      if (e.key === 'd' && v.can_double) act('double')
      if (e.key === 'p' && v.can_split) act('split')
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return (
    <motion.div className="action-bar bj-play" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
      <div className="action-buttons">
        <button className="act act-call" onClick={() => act('hit')}><span>Tirer</span><kbd>H</kbd></button>
        <button className="act act-fold" onClick={() => act('stand')}><span>Rester</span><kbd>S</kbd></button>
        {v.can_double && <button className="act act-raise" onClick={() => act('double')}><span>Doubler</span><kbd>D</kbd></button>}
        {v.can_split && <button className="act act-raise" onClick={() => act('split')}><span>Séparer</span><kbd>P</kbd></button>}
      </div>
    </motion.div>
  )
}

function Rules({ onClose }) {
  return (
    <div className="rankings">
      <div className="rankings-head">
        <h2>Règles du blackjack</h2>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>Fermer</button>
      </div>
      <ul className="rules-list">
        <li><strong>But du jeu</strong><span>Approcher 21 sans le dépasser et battre la main de la banque.</span></li>
        <li><strong>Valeur des cartes</strong><span>Les figures valent 10, l'As vaut 1 ou 11, les autres cartes leur valeur.</span></li>
        <li><strong>Blackjack</strong><span>Un As et une carte de valeur 10 dès les deux premières cartes. Payé 3 pour 2.</span></li>
        <li><strong>Tirer ou rester</strong><span>Tirez une carte pour vous rapprocher de 21, ou restez sur votre total.</span></li>
        <li><strong>Doubler</strong><span>Doublez la mise sur vos deux premières cartes et recevez une seule carte de plus.</span></li>
        <li><strong>Séparer</strong><span>Deux cartes de même valeur peuvent former deux mains, avec une mise égale sur chacune. Jusqu'à quatre mains.</span></li>
        <li><strong>La banque</strong><span>Tire jusqu'à 16 et reste à partir de 17. Six jeux de 52 cartes dans le sabot.</span></li>
        <li><strong>Gains</strong><span>Une main gagnante est payée 1 pour 1, une égalité rend la mise.</span></li>
      </ul>
    </div>
  )
}

export default function BlackjackScreen() {
  const v = useStore(s => s.bj)
  const [rules, setRules] = useState(false)
  const remaining = useCountdown(v?.timer_ms)
  if (!v) return <div className="loading">Ouverture de la table…</div>
  const progress = remaining != null && v.timer_total_ms ? remaining / v.timer_total_ms : null
  const myTurn = v.you != null && v.turn_seat === v.you && v.phase === 'playing'
  const canBet = v.you != null && (v.phase === 'waiting' || v.phase === 'betting')
  const dealerW = 84
  return (
    <div className="screen table-screen">
      <header className="table-top">
        <button className="btn btn-ghost" onClick={leaveTable}>Quitter la table</button>
        <div className="table-title">
          <h1>{v.table.name}</h1>
          <span>Blackjack, mise {range(v.table.min_bet, v.table.max_bet)}{v.round_no ? `, donne n°${v.round_no}` : ''}</span>
        </div>
        <div className="table-top-right">
          <button className={`btn btn-ghost ${rules ? 'is-on' : ''}`} onClick={() => setRules(r => !r)}>Règles</button>
          {v.you != null && <button className="btn btn-ghost" onClick={() => send({ t: 'stand' })}>Se lever</button>}
          <Balance />
        </div>
      </header>

      <Stage>
        <BlackjackFelt theme={v.table.theme} />

        <div className="bj-dealer" style={{ left: DEALER.x, top: DEALER.y }}>
          {v.dealer_cards.map((c, i) => (
            <Card
              key={`${v.round_no}-d-${i}`}
              code={c === '??' ? null : c}
              faceUp={c !== '??'}
              w={dealerW}
              style={{ position: 'absolute', left: -dealerW / 2 + (i - (v.dealer_cards.length - 1) / 2) * 62, top: -dealerW * 0.7 }}
              initial={{ x: SHOE.x - DEALER.x, y: SHOE.y - DEALER.y, opacity: 0, rotate: 40, scale: 0.6 }}
              delay={i < 2 ? 0.2 + i * 0.35 : 0}
            />
          ))}
          {v.dealer_value && (
            <div className="bj-value bj-dealer-value" style={{ top: dealerW * 0.7 + 10 }}>
              Banque {v.dealer_value === 'BJ' ? 'Blackjack' : v.dealer_value}
            </div>
          )}
        </div>

        {v.seats.map((_, i) => <BjSeat key={i} v={v} i={i} progress={progress} />)}

        {v.phase === 'waiting' && v.seats.every(s => !s || s.bet === 0) && (
          <div className="table-status table-status-bj">
            {v.you == null ? 'Choisissez une place pour vous asseoir' : 'Placez une mise pour lancer la donne'}
          </div>
        )}
      </Stage>

      <SidePanel log={v.log} />

      <AnimatePresence mode="wait">
        {canBet && <BetBar key="bet" v={v} remaining={remaining} />}
        {myTurn && <PlayBar key={`play-${v.turn_hand}`} v={v} />}
      </AnimatePresence>

      {!myTurn && v.phase === 'playing' && v.turn_seat != null && v.seats[v.turn_seat] && (
        <div className="waiting-hint">{v.turn_seat === v.you ? '' : `${v.seats[v.turn_seat].name} joue…`}</div>
      )}

      <AnimatePresence>
        {rules && (
          <motion.aside className="drawer" initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
            <Rules onClose={() => setRules(false)} />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  )
}
