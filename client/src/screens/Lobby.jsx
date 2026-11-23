import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { logout, send, toast, useStore } from '../net.js'
import { fmt, range, theme } from '../format.js'
import Card from '../components/Card.jsx'
import { ChipStack } from '../components/Chips.jsx'
import { MiniTable } from '../components/PokerFelt.jsx'
import HandRankings from '../components/HandRankings.jsx'
import AdminPanel from '../components/AdminPanel.jsx'
import { Balance, Modal } from '../components/Common.jsx'

const HERO_HAND = ['As', 'Kh', 'Qd', 'Jc', 'Ts']

function TableRow({ t }) {
  const full = t.players >= t.seats
  return (
    <li className="lobby-row">
      <MiniTable theme={t.theme} seats={t.seats} players={t.players} game={t.game} />
      <div className="lobby-row-main">
        <h3>{t.name}</h3>
        <p>
          {t.game === 'poker'
            ? `Blinds ${fmt(t.small_blind)}/${fmt(t.big_blind)}, buy-in ${range(t.min_buy, t.max_buy)}`
            : `Bets ${range(t.min_bet, t.max_bet)}`}
        </p>
      </div>
      <div className="lobby-row-meta">
        <span className="lobby-players"><b>{t.players}</b>/{t.seats} players</span>
        {t.watchers > t.players && <span className="lobby-watchers">{t.watchers - t.players} watching</span>}
        <span className="lobby-theme">{theme(t.theme).name}</span>
      </div>
      <button className="btn btn-brass" onClick={() => send({ t: 'join', table: t.id })}>
        {full ? 'Watch' : 'Join'}
      </button>
    </li>
  )
}

export default function Lobby() {
  const me = useStore(s => s.me)
  const playerId = useStore(s => s.playerId)
  const admin = useStore(s => s.admin)
  const tables = useStore(s => s.lobby)
  const [tab, setTab] = useState('poker')
  const [rankings, setRankings] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(playerId))
      toast('Number copied', 'info')
    } catch {
      toast(`Your number: ${playerId}`, 'info')
    }
  }
  useEffect(() => {
    send({ t: 'lobby' })
    const iv = setInterval(() => send({ t: 'lobby' }), 3000)
    return () => clearInterval(iv)
  }, [])
  const list = tables.filter(t => t.game === tab)
  const online = tables.reduce((a, t) => a + t.players, 0)
  return (
    <div className="screen lobby">
      <header className="lobby-top">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="38" height="38" />
          <span>Aurum Club</span>
        </div>
        <div className="lobby-top-right">
          {admin && <button className="btn btn-ghost" onClick={() => setAdminOpen(true)}>Admin</button>}
          <button className="player-id" onClick={copyId} title="Copy my player number">
            <span className="lobby-me">{me}</span>
            <span className="player-id-num">#{playerId}</span>
          </button>
          <Balance />
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-text">
          <h1>The tables are open.</h1>
          <p>Multiplayer Texas Hold'em and blackjack with virtual chips. Invite your friends and take a seat.</p>
          <div className="hero-actions">
            <button className="btn btn-brass btn-lg" onClick={() => { setTab('poker'); document.getElementById('tables')?.scrollIntoView({ behavior: 'smooth' }) }}>See the tables</button>
            <button className="btn btn-ghost btn-lg" onClick={() => setRankings(true)}>Hand rankings</button>
          </div>
          <p className="hero-online">{online > 0 ? `${online} player${online > 1 ? 's' : ''} seated right now` : 'No one is seated yet'}</p>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-felt" />
          <div className="hero-fan">
            {HERO_HAND.map((c, i) => (
              <Card
                key={c}
                code={c}
                w={128}
                className="hero-card"
                style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '50% 120%' }}
                initial={{ rotate: 0, y: 40, opacity: 0 }}
                animate={{ rotate: (i - 2) * 11, x: (i - 2) * 46, y: Math.abs(i - 2) * 10, opacity: 1 }}
                delay={0.15 + i * 0.08}
              />
            ))}
          </div>
          <div className="hero-chips">
            <ChipStack amount={7625} r={30} showLabel={false} />
          </div>
        </div>
      </section>

      <section className="tables" id="tables">
        <div className="tables-head">
          <h2>Choose a table</h2>
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={tab === 'poker'} className={tab === 'poker' ? 'on' : ''} onClick={() => setTab('poker')}>Poker</button>
            <button role="tab" aria-selected={tab === 'blackjack'} className={tab === 'blackjack' ? 'on' : ''} onClick={() => setTab('blackjack')}>Blackjack</button>
          </div>
        </div>
        <motion.ul key={tab} className="lobby-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {list.map(t => <TableRow key={t.id} t={t} />)}
        </motion.ul>
        <p className="lobby-foot">Virtual chips with no real value. Your balance is saved on your account and can be refilled below 2,000 chips. Click your player number to copy it and send it to an admin.</p>
      </section>

      <Modal open={rankings} onClose={() => setRankings(false)} className="modal-wide">
        <HandRankings onClose={() => setRankings(false)} />
      </Modal>

      <Modal open={adminOpen && admin} onClose={() => setAdminOpen(false)} className="modal-wide">
        <AdminPanel onClose={() => setAdminOpen(false)} />
      </Modal>
    </div>
  )
}
