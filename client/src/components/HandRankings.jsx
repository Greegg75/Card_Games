import Card from './Card.jsx'

const HANDS = [
  { cat: 9, name: 'Quinte flush royale', desc: "De l'As au 10, dans la même couleur.", cards: ['As', 'Ks', 'Qs', 'Js', 'Ts'], used: 5 },
  { cat: 8, name: 'Quinte flush', desc: 'Cinq cartes qui se suivent, de la même couleur.', cards: ['9h', '8h', '7h', '6h', '5h'], used: 5 },
  { cat: 7, name: 'Carré', desc: 'Quatre cartes de même valeur.', cards: ['Qc', 'Qd', 'Qh', 'Qs', '4d'], used: 4 },
  { cat: 6, name: 'Full', desc: 'Un brelan et une paire.', cards: ['Kh', 'Kd', 'Ks', '7c', '7h'], used: 5 },
  { cat: 5, name: 'Couleur', desc: 'Cinq cartes de la même couleur.', cards: ['Ad', 'Jd', '8d', '5d', '2d'], used: 5 },
  { cat: 4, name: 'Quinte', desc: "Cinq cartes qui se suivent. L'As peut servir de 1.", cards: ['Tc', '9d', '8s', '7h', '6c'], used: 5 },
  { cat: 3, name: 'Brelan', desc: 'Trois cartes de même valeur.', cards: ['8c', '8h', '8d', 'Ks', '3c'], used: 3 },
  { cat: 2, name: 'Double paire', desc: 'Deux paires différentes.', cards: ['Js', 'Jd', '4c', '4h', 'Ah'], used: 4 },
  { cat: 1, name: 'Paire', desc: 'Deux cartes de même valeur.', cards: ['Ac', 'Ad', '9s', '6h', '3c'], used: 2 },
  { cat: 0, name: 'Carte haute', desc: "Aucune combinaison : la plus haute carte l'emporte.", cards: ['As', 'Jh', '8c', '5d', '3s'], used: 1 }
]

export default function HandRankings({ current = null, onClose }) {
  return (
    <div className="rankings">
      <div className="rankings-head">
        <h2>Classement des mains</h2>
        {onClose && <button className="btn btn-ghost btn-xs" onClick={onClose}>Fermer</button>}
      </div>
      <p className="rankings-sub">De la plus forte à la plus faible. Votre meilleure combinaison de cinq cartes, parmi vos deux cartes et les cinq du tableau, est prise en compte.</p>
      <ol className="rankings-list">
        {HANDS.map(h => (
          <li key={h.cat} className={current === h.cat ? 'is-current' : ''}>
            <div className="rankings-text">
              <strong>{h.name}</strong>
              <span>{h.desc}</span>
              {current === h.cat && <em>Votre main actuelle</em>}
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
