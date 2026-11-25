import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { chooseSection, logout, send, toast, useStore } from '../net.js'
import Card from '../components/Card.jsx'
import { ChipStack } from '../components/Chips.jsx'
import { Balance } from '../components/Common.jsx'

const GAMES = [
  {
    id: 'poker',
    name: 'Poker',
    kind: "Texas Hold'em, No Limit",
    text: 'Play against your friends around the table. A hand starts as soon as two players are seated.',
    cards: ['As', 'Ah'],
    chips: 2750
  },
  {
    id: 'blackjack',
    name: 'Blackjack',
    kind: 'Against the dealer',
    text: 'Play on your own or with friends. Reach 21 without going over and beat the dealer.',
    cards: ['Ad', 'Ks'],
    chips: 500
  }
]

function seatedText(players) {
  if (players === 0) return 'Nobody seated right now'
  return `${players} player${players > 1 ? 's' : ''} seated right now`
}

export default function Home() {
  const me = useStore(s => s.me)
  const playerId = useStore(s => s.playerId)
  const tables = useStore(s => s.lobby)
  useEffect(() => {
    send({ t: 'lobby' })
    const iv = setInterval(() => send({ t: 'lobby' }), 5000)
    return () => clearInterval(iv)
  }, [])
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(playerId))
      toast('Number copied', 'info')
    } catch {
      toast(`Your number: ${playerId}`, 'info')
    }
  }
  return (
    <div className="screen lobby home">
      <header className="lobby-top">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="38" height="38" />
          <span>Aurum Club</span>
        </div>
        <div className="lobby-top-right">
          <button className="player-id" onClick={copyId} title="Copy my player number">
            <span className="lobby-me">{me}</span>
            <span className="player-id-num">#{playerId}</span>
          </button>
          <Balance />
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      <section className="home-intro">
        <h1>What are we playing, {me}?</h1>
        <p>Pick a game to see its tables. You can switch at any time from the lobby.</p>
      </section>

      <section className="home-games">
        {GAMES.map((g, gi) => {
          const list = tables.filter(t => t.game === g.id)
          const players = list.reduce((a, t) => a + t.players, 0)
          return (
            <motion.button
              key={g.id}
              className={`home-game home-game-${g.id}`}
              onClick={() => chooseSection(g.id)}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + gi * 0.1, type: 'spring', stiffness: 220, damping: 26 }}
            >
              <div className="home-game-art" aria-hidden="true">
                <div className="home-game-cards">
                  {g.cards.map((c, i) => (
                    <Card
                      key={c}
                      code={c}
                      w={104}
                      className="home-game-card"
                      style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '50% 115%' }}
                      initial={{ rotate: 0, y: 30, opacity: 0 }}
                      animate={{ rotate: i === 0 ? -9 : 9, x: i === 0 ? -34 : 34, y: 0, opacity: 1 }}
                      delay={0.25 + gi * 0.1 + i * 0.08}
                    />
                  ))}
                </div>
                <div className="home-game-chips">
                  <ChipStack amount={g.chips} r={22} showLabel={false} />
                </div>
              </div>
              <div className="home-game-body">
                <span className="home-game-kind">{g.kind}</span>
                <h2>{g.name}</h2>
                <p>{g.text}</p>
                <div className="home-game-meta">
                  <span className={`dot ${players > 0 ? 'dot-on' : ''}`} />
                  <span>{seatedText(players)}</span>
                  <span className="home-game-count">{list.length} tables</span>
                </div>
                <span className="btn btn-brass home-game-cta">Play {g.name}</span>
              </div>
            </motion.button>
          )
        })}
      </section>

      <p className="lobby-foot">Virtual chips with no real value. Your balance is shared between both games.</p>
    </div>
  )
}
