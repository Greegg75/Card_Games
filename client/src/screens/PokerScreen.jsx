import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { send, useStore } from '../net.js'
import { fmt } from '../format.js'
import Card from '../components/Card.jsx'
import { ChipStack } from '../components/Chips.jsx'
import PokerFelt from '../components/PokerFelt.jsx'
import HandRankings from '../components/HandRankings.jsx'
import { Avatar, Balance, Modal, SidePanel, Stage, leaveTable, useCountdown } from '../components/Common.jsx'

const CX = 800
const CY = 440
const DECK = { x: 800, y: 300 }

function angle(d, n) {
  return (2 * Math.PI * d) / n
}

function seatXY(d, n) {
  const t = angle(d, n)
  return { x: CX - 650 * Math.sin(t), y: CY + 345 * Math.cos(t) }
}

function betXY(d, n) {
  const t = angle(d, n)
  return { x: CX - 445 * Math.sin(t), y: CY + 185 * Math.cos(t) }
}

function buttonXY(d, n) {
  const t = angle(d, n)
  const b = { x: CX - 520 * Math.sin(t), y: CY + 250 * Math.cos(t) }
  return { x: b.x + 62 * Math.cos(t), y: b.y + 30 * Math.sin(t) }
}

function Seat({ s, view, index, d, n, isYou, progress, winner, onSit }) {
  const { x, y } = seatXY(d, n)
  if (!s) {
    if (view.you != null) return <div className="seat seat-empty" style={{ left: x, top: y }}><div className="seat-free">Open</div></div>
    return (
      <div className="seat seat-empty" style={{ left: x, top: y }}>
        <button className="seat-sit" onClick={() => onSit(index)}>
          <span className="seat-sit-plus">+</span>
          <span>Sit down</span>
        </button>
      </div>
    )
  }
  const active = view.to_act === index
  const cards = isYou ? view.my_cards : s.cards
  const showFaces = isYou ? cards.length > 0 : !!s.cards
  const hasCards = isYou ? cards.length > 0 && !s.folded : s.has_cards
  const w = isYou ? 88 : 60
  const from = { x: DECK.x - x, y: DECK.y - (y - (isYou ? 92 : 62)) }
  const best = winner?.best || []
  return (
    <div className={`seat ${isYou ? 'seat-you' : ''} ${s.folded ? 'seat-folded' : ''}`} style={{ left: x, top: y }}>
      <div className={`seat-cards ${isYou ? 'seat-cards-you' : ''}`}>
        <AnimatePresence>
          {hasCards && [0, 1].map(i => (
            <Card
              key={`${view.hand_no}-${i}`}
              code={showFaces ? cards[i] : null}
              faceUp={showFaces}
              w={w}
              glow={best.includes(cards?.[i])}
              dim={isYou && s.folded}
              className={`seat-card seat-card-${i}`}
              initial={{ x: from.x, y: from.y, opacity: 0, scale: 0.5, rotate: -30 }}
              animate={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: i === 0 ? -7 : 7 }}
              delay={i * 0.18 + d * 0.05}
            />
          ))}
        </AnimatePresence>
      </div>
      <Avatar name={s.name} size={isYou ? 92 : 80} progress={active ? progress : null} active={active} dim={s.folded} winner={!!winner} />
      <div className={`plate ${active ? 'plate-active' : ''} ${winner ? 'plate-winner' : ''}`}>
        <div className="plate-name">{s.name}</div>
        <div className="plate-stack">{s.all_in && s.stack === 0 ? 'All-in' : fmt(s.stack)}</div>
      </div>
      <AnimatePresence>
        {s.last_action && !winner && (
          <motion.div key={s.last_action} className={`action-tag tag-${tagKind(s.last_action)}`} initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}>
            {s.last_action}
          </motion.div>
        )}
      </AnimatePresence>
      {s.hand_name && <div className="seat-hand-name">{s.hand_name}</div>}
      {isYou && view.my_hand && !s.folded && !s.hand_name && <div className="seat-hand-name seat-hand-live">{view.my_hand}</div>}
    </div>
  )
}

function tagKind(a) {
  if (a.startsWith('Fold')) return 'fold'
  if (a.startsWith('All-in')) return 'allin'
  if (a.startsWith('Raise') || a.startsWith('Bet')) return 'raise'
  if (a.startsWith('Call')) return 'call'
  if (a.includes('blind')) return 'blind'
  return 'check'
}

function ActionBar({ v }) {
  const me = v.seats[v.you]
  const bets = v.seats.reduce((a, s) => a + (s ? s.bet : 0), 0)
  const potTotal = v.pot + bets
  const step = Math.max(1, v.table.small_blind)
  const canRaise = v.max_raise_to > v.current_bet && v.max_raise_to > me.bet + v.to_call
  const [amt, setAmt] = useState(v.min_raise_to)
  useEffect(() => { setAmt(v.min_raise_to) }, [v.min_raise_to, v.to_act, v.phase])
  const clamp = a => Math.max(v.min_raise_to, Math.min(v.max_raise_to, Math.round(a / step) * step || a))
  const potRaise = f => clamp(me.bet + v.to_call + (potTotal + v.to_call) * f)
  const target = clamp(amt)
  const isAllIn = target >= v.max_raise_to
  const act = (kind, amount) => send({ t: 'act', kind, amount })
  const raise = () => { setAmt(target); isAllIn ? act('allin') : act('raise', target) }
  useEffect(() => {
    const k = e => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return
      if (e.key === 'f') act('fold')
      if (e.key === 'c') act(v.to_call === 0 ? 'check' : 'call')
      if (e.key === 'r' && canRaise) raise()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  return (
    <motion.div className="action-bar" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }}>
      {canRaise && (
        <div className="raise-row">
          <div className="presets">
            <button onClick={() => setAmt(v.min_raise_to)}>Min</button>
            <button onClick={() => setAmt(potRaise(0.5))}>½ Pot</button>
            <button onClick={() => setAmt(potRaise(0.75))}>¾ Pot</button>
            <button onClick={() => setAmt(potRaise(1))}>Pot</button>
            <button onClick={() => setAmt(v.max_raise_to)}>All-in</button>
          </div>
          <div className="slider-row">
            <input type="range" min={v.min_raise_to} max={v.max_raise_to} step={step} value={amt} onChange={e => setAmt(Number(e.target.value))} aria-label="Raise amount" />
            <input type="number" className="amount-input" min={v.min_raise_to} max={v.max_raise_to} value={amt} onChange={e => setAmt(Number(e.target.value))} onBlur={() => setAmt(clamp(amt))} aria-label="Amount" />
          </div>
        </div>
      )}
      <div className="action-buttons">
        <button className="act act-fold" onClick={() => act('fold')}>
          <span>Fold</span><kbd>F</kbd>
        </button>
        {v.to_call === 0 ? (
          <button className="act act-call" onClick={() => act('check')}><span>Check</span><kbd>C</kbd></button>
        ) : (
          <button className="act act-call" onClick={() => act('call')}>
            <span>{v.to_call >= me.stack ? 'All-in' : 'Call'}</span><b>{fmt(v.to_call)}</b><kbd>C</kbd>
          </button>
        )}
        {canRaise && (
          <button className="act act-raise" onClick={raise}>
            <span>{isAllIn ? 'All-in' : v.current_bet === 0 ? 'Bet' : 'Raise to'}</span><b>{fmt(target)}</b><kbd>R</kbd>
          </button>
        )}
      </div>
    </motion.div>
  )
}

function BuyIn({ table, seat, onClose }) {
  const balance = useStore(s => s.balance)
  const max = Math.min(table.max_buy, balance)
  const [amt, setAmt] = useState(Math.min(table.max_buy, Math.max(table.min_buy, Math.floor(balance / 2))))
  const ok = balance >= table.min_buy
  return (
    <div className="buyin">
      <h2>Take a seat</h2>
      <p>Choose your buy-in for {table.name}. Any chips you have left go back to your balance when you leave the table.</p>
      {ok ? (
        <>
          <div className="buyin-amount">{fmt(amt)}</div>
          <input type="range" min={table.min_buy} max={max} step={table.big_blind} value={amt} onChange={e => setAmt(Number(e.target.value))} aria-label="Buy-in amount" />
          <div className="buyin-range"><span>Min {fmt(table.min_buy)}</span><span>Max {fmt(max)}</span></div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-brass" onClick={() => { send({ t: 'sit', seat, buy_in: amt }); onClose() }}>Sit down with {fmt(amt)}</button>
          </div>
        </>
      ) : (
        <>
          <p className="buyin-warn">You need at least {fmt(table.min_buy)} chips for this table.</p>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
            {balance < 2000 && <button className="btn btn-brass" onClick={() => send({ t: 'refill' })}>Refill my balance</button>}
          </div>
        </>
      )}
    </div>
  )
}

function PotDisplay({ v }) {
  const show = v.phase === 'showdown' ? v.pots : [v.pot]
  const total = show.reduce((a, b) => a + b, 0)
  if (!total) return null
  return (
    <div className="pot" style={{ left: DECK.x, top: DECK.y }}>
      {v.phase !== 'showdown' && <ChipStack amount={v.pot} r={15} showLabel={false} />}
      <div className="pot-pills">
        {show.map((p, i) => p > 0 && (
          <div key={i} className="pot-pill">{show.length > 1 ? (i === 0 ? 'Main pot' : `Side pot ${i}`) : 'Pot'} <b>{fmt(p)}</b></div>
        ))}
      </div>
    </div>
  )
}

export default function PokerScreen() {
  const v = useStore(s => s.poker)
  const me = useStore(s => s.me)
  const [sitAt, setSitAt] = useState(null)
  const [rankings, setRankings] = useState(false)
  const remaining = useCountdown(v?.timer_ms)
  const winners = useMemo(() => {
    const m = {}
    if (v?.phase === 'showdown') for (const w of v.winners) m[w.seat] = w
    return m
  }, [v])
  if (!v) return <div className="loading">Opening the table…</div>
  const n = v.seats.length
  const rot = i => (v.you != null ? (i - v.you + n) % n : i)
  const progress = remaining != null && v.timer_total_ms ? remaining / v.timer_total_ms : null
  const myTurn = v.you != null && v.to_act === v.you
  const topWinner = v.winners[0]
  const boardBest = topWinner?.best || []
  const seated = v.seats.filter(Boolean).length
  return (
    <div className="screen table-screen">
      <header className="table-top">
        <button className="btn btn-ghost" onClick={leaveTable}>Leave table</button>
        <div className="table-title">
          <h1>{v.table.name}</h1>
          <span>No-Limit Texas Hold'em, blinds {fmt(v.table.small_blind)}/{fmt(v.table.big_blind)}{v.hand_no ? `, hand #${v.hand_no}` : ''}</span>
        </div>
        <div className="table-top-right">
          <button className={`btn btn-ghost ${rankings ? 'is-on' : ''}`} onClick={() => setRankings(r => !r)}>Hand rankings</button>
          {v.you != null && <button className="btn btn-ghost" onClick={() => send({ t: 'stand' })}>Stand up</button>}
          <Balance />
        </div>
      </header>

      <Stage>
        <PokerFelt theme={v.table.theme} title={`Blinds ${fmt(v.table.small_blind)}/${fmt(v.table.big_blind)}`} />

        <div className="board">
          <AnimatePresence>
            {v.board.map((c, i) => (
              <Card
                key={`${v.hand_no}-${c}`}
                code={c}
                w={82}
                glow={boardBest.includes(c)}
                dim={v.phase === 'showdown' && boardBest.length > 0 && !boardBest.includes(c)}
                style={{ position: 'absolute', left: 575 + i * 92, top: 370 }}
                initial={{ x: DECK.x - 616 - i * 92, y: DECK.y - 427, opacity: 0, scale: 0.6, rotate: -20 }}
                delay={i < 3 ? i * 0.12 : 0}
              />
            ))}
          </AnimatePresence>
        </div>

        <PotDisplay v={v} />

        {v.seats.map((s, i) => s && s.bet > 0 && (() => {
          const p = betXY(rot(i), n)
          return (
            <motion.div key={`bet-${i}`} className="bet" style={{ left: p.x, top: p.y, x: '-50%', y: '-50%' }} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}>
              <ChipStack amount={s.bet} r={13} />
            </motion.div>
          )
        })())}

        {v.button != null && (() => {
          const p = buttonXY(rot(v.button), n)
          return <motion.div className="dealer-btn" animate={{ left: p.x, top: p.y }} transition={{ type: 'spring', stiffness: 120, damping: 18 }}>D</motion.div>
        })()}

        {v.seats.map((s, i) => (
          <Seat
            key={i}
            s={s}
            view={v}
            index={i}
            d={rot(i)}
            n={n}
            isYou={v.you === i}
            progress={progress}
            winner={winners[i]}
            onSit={setSitAt}
          />
        ))}

        <AnimatePresence>
          {v.phase === 'showdown' && v.winners.map(w => {
            const p = seatXY(rot(w.seat), n)
            return (
              <motion.div
                key={`win-${v.hand_no}-${w.seat}`}
                className="win-chips"
                style={{ x: '-50%', y: '-50%' }}
                initial={{ left: DECK.x, top: DECK.y, opacity: 1 }}
                animate={{ left: p.x, top: p.y - 20, opacity: [1, 1, 0] }}
                transition={{ duration: 1.1, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
              >
                <ChipStack amount={w.amount} r={15} showLabel={false} />
              </motion.div>
            )
          })}
        </AnimatePresence>

        <AnimatePresence>
          {v.phase === 'showdown' && topWinner && (
            <motion.div key={`banner-${v.hand_no}`} className="win-banner" style={{ x: '-50%' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <strong>{topWinner.name === me ? 'You win' : `${topWinner.name} wins`} {fmt(topWinner.amount)}</strong>
              {topWinner.hand_name && <span>{topWinner.hand_name}</span>}
              {v.winners.length > 1 && <span>{v.winners.slice(1).map(w => `${w.name} +${fmt(w.amount)}`).join(', ')}</span>}
            </motion.div>
          )}
        </AnimatePresence>

        {v.phase === 'waiting' && (
          <div className="table-status">
            {seated < 2
              ? (v.you == null ? 'Pick a seat to sit down' : 'Waiting for another player')
              : `Game starts in ${Math.ceil((remaining ?? 0) / 1000)}s`}
          </div>
        )}
      </Stage>

      <SidePanel log={v.log} />

      <AnimatePresence>{myTurn && <ActionBar key={`${v.hand_no}-${v.phase}-${v.current_bet}`} v={v} />}</AnimatePresence>

      {!myTurn && v.you != null && v.to_act != null && v.seats[v.to_act] && (
        <div className="waiting-hint">{v.seats[v.to_act].name} is thinking…</div>
      )}

      <AnimatePresence>
        {rankings && (
          <motion.aside className="drawer" initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}>
            <HandRankings current={v.my_category} onClose={() => setRankings(false)} />
          </motion.aside>
        )}
      </AnimatePresence>

      <Modal open={sitAt != null} onClose={() => setSitAt(null)}>
        {sitAt != null && <BuyIn table={v.table} seat={sitAt} onClose={() => setSitAt(null)} />}
      </Modal>
    </div>
  )
}
