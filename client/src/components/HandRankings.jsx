import Card from './Card.jsx'

const HANDS = [
  { cat: 9, name: 'Royal flush', desc: 'Ace to ten, all of the same suit.', cards: ['As', 'Ks', 'Qs', 'Js', 'Ts'], used: 5 },
  { cat: 8, name: 'Straight flush', desc: 'Five cards in a row, all of the same suit.', cards: ['9h', '8h', '7h', '6h', '5h'], used: 5 },
  { cat: 7, name: 'Four of a kind', desc: 'Four cards of the same rank.', cards: ['Qc', 'Qd', 'Qh', 'Qs', '4d'], used: 4 },
  { cat: 6, name: 'Full house', desc: 'Three of a kind plus a pair.', cards: ['Kh', 'Kd', 'Ks', '7c', '7h'], used: 5 },
  { cat: 5, name: 'Flush', desc: 'Five cards of the same suit.', cards: ['Ad', 'Jd', '8d', '5d', '2d'], used: 5 },
  { cat: 4, name: 'Straight', desc: 'Five cards in a row. The ace can also play low.', cards: ['Tc', '9d', '8s', '7h', '6c'], used: 5 },
  { cat: 3, name: 'Three of a kind', desc: 'Three cards of the same rank.', cards: ['8c', '8h', '8d', 'Ks', '3c'], used: 3 },
  { cat: 2, name: 'Two pair', desc: 'Two different pairs.', cards: ['Js', 'Jd', '4c', '4h', 'Ah'], used: 4 },
  { cat: 1, name: 'Pair', desc: 'Two cards of the same rank.', cards: ['Ac', 'Ad', '9s', '6h', '3c'], used: 2 },
  { cat: 0, name: 'High card', desc: 'No combination: the highest card wins.', cards: ['As', 'Jh', '8c', '5d', '3s'], used: 1 }
]

export default function HandRankings({ current = null, onClose }) {
  return (
    <div className="rankings">
      <div className="rankings-head">
        <h2>Hand rankings</h2>
        {onClose && <button className="btn btn-ghost btn-xs" onClick={onClose}>Close</button>}
      </div>
      <p className="rankings-sub">From strongest to weakest. Your best five-card combination, using your two cards and the five on the board, is what counts.</p>
      <ol className="rankings-list">
        {HANDS.map(h => (
          <li key={h.cat} className={current === h.cat ? 'is-current' : ''}>
            <div className="rankings-text">
              <strong>{h.name}</strong>
              <span>{h.desc}</span>
              {current === h.cat && <em>Your current hand</em>}
            </div>
            <div className="rankings-cards">
              {h.cards.map((c, i) => (
                <Card key={c} code={c} w={34} dim={i >= h.used} initial={false} />
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
