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
  if (r === 'Win') return 'win'
  if (r === 'Push') return 'push'
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
            {hand.result}{hand.payout > 0 && hand.result !== 'Push' ? ` +${fmt(hand.payout)}` : ''}
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
            <span>Sit down</span>
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
          <div className="plate-stack">{s.last_bet ? `Bet ${fmt(s.last_bet)}` : isYou ? 'You' : 'Seated'}</div>
        </div>
      </div>
    </>
  )
}

const SLIDER_STEPS = 1000

function niceUnit(min) {
  if (min >= 10) return Math.max(1, Math.round(min / 10))
  return 1
}

function BetBar({ v, remaining }) {
  const balance = useStore(s => s.balance)
  const me = v.seats[v.you]
  const min = v.table.min_bet
  const max = Math.min(v.table.max_bet, balance + me.bet)
  const unit = niceUnit(min)
  const canBet = max >= min
  const snap = x => Math.max(min, Math.min(max, x >= max ? max : Math.round(x / unit) * unit))
  const [amt, setAmt] = useState(() => snap(me.bet || me.last_bet || min))
  const [typed, setTyped] = useState(null)
  useEffect(() => { if (me.bet > 0) setAmt(snap(me.bet)) }, [me.bet])
  useEffect(() => { setAmt(a => snap(a)) }, [max])
  const chips = DENOMS.map(d => d.v).filter(x => x <= v.table.max_bet && x * 20 >= min).reverse().slice(0, 6)
  const bet = amount => send({ t: 'bet', amount })
  const place = () => send({ t: 'act', kind: 'set', amount: snap(typed ?? amt) })
  const pos = max > min ? Math.round(((amt - min) / (max - min)) * SLIDER_STEPS) : SLIDER_STEPS
  const fromPos = p => snap(p >= SLIDER_STEPS ? max : min + ((max - min) * p) / SLIDER_STEPS)
  const commitTyped = () => {
    if (typed == null) return
    setAmt(snap(Number(typed) || min))
    setTyped(null)
  }
  return (
    <motion.div className="bj-bar" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
      <div className="bj-bar-main">
        <div className="bj-bar-info">
          <strong>{me.bet > 0 ? `Your bet: ${fmt(me.bet)}` : 'Place your bet'}</strong>
          <span>
            {v.phase === 'betting' && remaining != null ? `Dealing in ${Math.ceil(remaining / 1000)}s` : `Bets ${range(min, v.table.max_bet)}`}
          </span>
        </div>
        <div className="bj-chips">
          {chips.map(c => (
            <button key={c} className="chip-btn" disabled={balance < c || me.bet + c > v.table.max_bet} onClick={() => bet(c)} aria-label={`Add ${c}`}>
              <Chip value={c} size={58} />
            </button>
          ))}
        </div>
        <div className="bj-bar-actions">
          <button className="btn btn-ghost btn-sm" disabled={!me.bet} onClick={() => send({ t: 'act', kind: 'clear' })}>Clear</button>
          <button className="btn btn-ghost btn-sm" disabled={!me.last_bet || me.bet > 0} onClick={() => send({ t: 'act', kind: 'rebet' })}>Rebet {me.last_bet ? fmt(me.last_bet) : ''}</button>
        </div>
      </div>
      {canBet ? (
        <div className="bj-slider">
          <div className="presets">
            <button onClick={() => setAmt(min)}>Min</button>
            <button onClick={() => setAmt(snap(min + (max - min) / 4))}>¼</button>
            <button onClick={() => setAmt(snap(min + (max - min) / 2))}>½</button>
            <button onClick={() => setAmt(max)}>Max</button>
          </div>
          <div className="slider-row">
            <span className="bj-slider-end">{fmt(min)}</span>
            <input type="range" min={0} max={SLIDER_STEPS} step={1} value={pos} onChange={e => { setTyped(null); setAmt(fromPos(Number(e.target.value))) }} aria-label="Bet amount" />
            <span className="bj-slider-end">{fmt(max)}</span>
            <input
              type="number"
              className="amount-input"
              min={min}
              max={max}
              value={typed ?? amt}
              onChange={e => setTyped(e.target.value)}
              onBlur={commitTyped}
              onKeyDown={e => { if (e.key === 'Enter') { commitTyped(); place() } }}
              aria-label="Exact bet"
            />
            <button className="btn btn-brass" disabled={snap(typed ?? amt) === me.bet} onClick={() => { commitTyped(); place() }}>
              {me.bet > 0 ? 'Change bet to' : 'Bet'} {fmt(snap(typed ?? amt))}
            </button>
          </div>
        </div>
      ) : (
        <div className="bj-slider bj-slider-empty">You need at least {fmt(min)} chips to bet at this table.</div>
      )}
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
        <button className="act act-call" onClick={() => act('hit')}><span>Hit</span><kbd>H</kbd></button>
        <button className="act act-fold" onClick={() => act('stand')}><span>Stand</span><kbd>S</kbd></button>
        {v.can_double && <button className="act act-raise" onClick={() => act('double')}><span>Double</span><kbd>D</kbd></button>}
        {v.can_split && <button className="act act-raise" onClick={() => act('split')}><span>Split</span><kbd>P</kbd></button>}
      </div>
    </motion.div>
  )
}

function Rules({ onClose }) {
  return (
    <div className="rankings">
      <div className="rankings-head">
        <h2>Blackjack rules</h2>
        <button className="btn btn-ghost btn-xs" onClick={onClose}>Close</button>
      </div>
      <ul className="rules-list">
        <li><strong>Goal</strong><span>Get as close to 21 as you can without going over, and beat the dealer’s hand.</span></li>
        <li><strong>Card values</strong><span>Face cards are worth 10, an ace is worth 1 or 11, every other card is worth its number.</span></li>
        <li><strong>Blackjack</strong><span>An ace and a ten-value card as your first two cards. Pays 3 to 2.</span></li>
        <li><strong>Hit or stand</strong><span>Take another card to get closer to 21, or stand on your total.</span></li>
        <li><strong>Double down</strong><span>Double your bet on your first two cards and receive exactly one more card.</span></li>
        <li><strong>Split</strong><span>Two cards of the same value can be split into two hands, with an equal bet on each. Up to four hands.</span></li>
        <li><strong>The dealer</strong><span>Hits on 16 or less and stands on 17 or more. The shoe holds six 52-card decks.</span></li>
        <li><strong>Payouts</strong><span>A winning hand pays 1 to 1, a push returns your bet.</span></li>
      </ul>
    </div>
  )
}

export default function BlackjackScreen() {
  const v = useStore(s => s.bj)
  const [rules, setRules] = useState(false)
  const remaining = useCountdown(v?.timer_ms)
  if (!v) return <div className="loading">Opening the table…</div>
  const progress = remaining != null && v.timer_total_ms ? remaining / v.timer_total_ms : null
  const myTurn = v.you != null && v.turn_seat === v.you && v.phase === 'playing'
  const canBet = v.you != null && (v.phase === 'waiting' || v.phase === 'betting')
  const dealerW = 84
  return (
    <div className="screen table-screen">
      <header className="table-top">
        <button className="btn btn-ghost" onClick={leaveTable}>Leave table</button>
        <div className="table-title">
          <h1>{v.table.name}</h1>
          <span>Blackjack, bets {range(v.table.min_bet, v.table.max_bet)}{v.round_no ? `, round #${v.round_no}` : ''}</span>
        </div>
        <div className="table-top-right">
          <button className={`btn btn-ghost ${rules ? 'is-on' : ''}`} onClick={() => setRules(r => !r)}>Rules</button>
          {v.you != null && <button className="btn btn-ghost" onClick={() => send({ t: 'stand' })}>Stand up</button>}
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
              Dealer {v.dealer_value === 'BJ' ? 'Blackjack' : v.dealer_value}
            </div>
          )}
        </div>

        {v.seats.map((_, i) => <BjSeat key={i} v={v} i={i} progress={progress} />)}

        {v.phase === 'waiting' && v.seats.every(s => !s || s.bet === 0) && (
          <div className="table-status table-status-bj">
            {v.you == null ? 'Pick a seat to sit down' : 'Place a bet to start the round'}
          </div>
        )}
      </Stage>

      <SidePanel log={v.log} />

      <AnimatePresence mode="wait">
        {canBet && <BetBar key="bet" v={v} remaining={remaining} />}
        {myTurn && <PlayBar key={`play-${v.turn_hand}`} v={v} />}
      </AnimatePresence>

      {!myTurn && v.phase === 'playing' && v.turn_seat != null && v.seats[v.turn_seat] && (
        <div className="waiting-hint">{v.turn_seat === v.you ? '' : `${v.seats[v.turn_seat].name} is playing…`}</div>
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
