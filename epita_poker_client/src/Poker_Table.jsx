import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePokerWebSocket } from './usePokerWebSocket';
import { LogOut, Info, X, Trophy, ChevronUp } from 'lucide-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import tableImage from './assets/nouvelle_table.jpg';

/* ── SEAT POSITIONS (9-max) ──────────────────────────── */
const ChipStack = ({ amount, isPot = false, delay = 0 }) => {
  if (amount <= 0) return null;
  const chipCount = Math.min(Math.max(Math.ceil(amount / 100), 1), 8);
  const colors = isPot
    ? { chip: '#a07828', shadow: '#5a4010' }
    : { chip: '#1a3a5a', shadow: '#0a1e30' };
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }} transition={{ delay }}
      className={`relative flex flex-col items-center justify-end ${isPot ? 'w-20 h-20' : 'w-14 h-14'}`}>
      <div className="relative w-full h-full flex justify-center">
        {[...Array(chipCount)].map((_, i) => (
          <div key={i}
            className="absolute w-8 h-4 md:w-10 md:h-5 rounded-[50%] border border-dashed border-white/20 shadow-xl"
            style={{ bottom: `${i * 3}px`, zIndex: i, backgroundColor: colors.chip }}>
            <div className="absolute inset-0 rounded-[50%] translate-y-[2px] -z-10" style={{ backgroundColor: colors.shadow }} />
          </div>
        ))}
      </div>
      <span className="bg-black/95 px-2 py-0.5 rounded text-[9px] text-amber-400/90 font-mono font-medium mt-1 border border-white/10 z-10 shadow-lg tracking-wider">
        ${amount}
      </span>
    </motion.div>
  );
};

/* ── POKER HANDS REF ─────────────────────────────────── */
const POKER_HANDS = [
  { rank: 1,  name: "Quinte Flush Royale", desc: "A, K, Q, J, 10 de la même couleur",       color: "#d4a843" },
  { rank: 2,  name: "Quinte Flush",        desc: "5 cartes de même couleur consécutives",    color: "#c4922a" },
  { rank: 3,  name: "Carré",               desc: "4 cartes de même valeur",                  color: "#b07020" },
  { rank: 4,  name: "Full House",          desc: "Un brelan + une paire",                    color: "#c44a20" },
  { rank: 5,  name: "Couleur (Flush)",     desc: "5 cartes de la même couleur",              color: "#8a3a6a" },
  { rank: 6,  name: "Quinte (Suite)",      desc: "5 cartes consécutives",                    color: "#2a7a5a" },
  { rank: 7,  name: "Brelan",              desc: "3 cartes de même valeur",                  color: "#2a6a8a" },
  { rank: 8,  name: "Double Paire",        desc: "Deux paires distinctes",                   color: "#3a4a8a" },
  { rank: 9,  name: "Paire",               desc: "2 cartes de même valeur",                  color: "#4a4a7a" },
  { rank: 10, name: "Carte Haute",         desc: "La carte la plus forte en jeu",            color: "#4a4a4a" },
];

/* ── SEAT POSITIONS (9-max) ──────────────────────────── */
// Chaque siège a ses propres coordonnées brutes pour :
//   chairTop/Left  — chaise
//   cardTop/Left   — bloc de 2 cartes
//   badgeTop/Left  — badge nom + chips
//   betTop/Left    — pile de jetons de mise
const SEAT_POSITIONS = [
  // 0 — Toi (bas centre)
  { chairTop: '110%', chairLeft: '50%', angle: 180,
    cardTop:  '88%',  cardLeft:  '50%',
    badgeTop: '110%',  badgeLeft: '50%',
    betTop:   '64%',  betLeft:   '50%' },

  // 1 — Bas gauche
  { chairTop: '110%', chairLeft: '22%', angle: 180,
    cardTop:  '88%',  cardLeft:  '22%',
    badgeTop: '110%',  badgeLeft: '22%',
    betTop:   '64%',  betLeft:   '30%' },

  // 2 — Gauche bas
  { chairTop: '70%',  chairLeft: '2%', angle: 270,
    cardTop:  '78%',  cardLeft:  '10%',
    badgeTop: '73.5%',  badgeLeft: '2%',
    betTop:   '62%',  betLeft:   '19%' },

  // 3 — Gauche haut
  { chairTop: '30%',  chairLeft: '2%', angle: 270,
    cardTop:  '18%',  cardLeft:  '10%',
    badgeTop: '27.5%',  badgeLeft: '2%',
    betTop:   '38%',  betLeft:   '19%' },

  // 4 — Haut gauche
  { chairTop: '-10%', chairLeft: '33%', angle: 0,
    cardTop:  '12%',  cardLeft:  '33.3%',
    badgeTop: '-10%',   badgeLeft: '33.3%',
    betTop:   '31%',  betLeft:   '31%' },

  // 5 — Haut droite
  { chairTop: '-10%', chairLeft: '66%', angle: 0,
    cardTop:  '12%',  cardLeft:  '66.6%',
    badgeTop: '-10%',   badgeLeft: '66.6%',
    betTop:   '31%',  betLeft:   '69%' },

  // 6 — Droite haut
  { chairTop: '30%',  chairLeft: '98%', angle: 90,
    cardTop:  '32%',  cardLeft:  '90%',
    badgeTop: '27.5%',  badgeLeft: '98%',
    betTop:   '38%',  betLeft:   '79%' },

  // 7 — Droite bas
  { chairTop: '70%',  chairLeft: '98%', angle: 90,
    cardTop:  '72%',  cardLeft:  '90%',
    badgeTop: '73.5%',  badgeLeft: '98%',
    betTop:   '62%',  betLeft:   '79%' },

  // 8 — Bas droite
  { chairTop: '110%', chairLeft: '78%', angle: 180,
    cardTop:  '88%',  cardLeft:  '78%',
    badgeTop: '110%',  badgeLeft: '78%',
    betTop:   '64%',  betLeft:   '70%' },
];

/* ── MAIN COMPONENT ──────────────────────────────────── */
export default function PokerTable() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tableId } = useParams();
  const pseudoFromState = location.state?.pseudo || '';
  
  const wsUrl = `ws://127.0.0.1:3000/ws/${tableId || 'table1'}`;
  const { gameState, sendAction, myPseudo, mySeat } = usePokerWebSocket(wsUrl, pseudoFromState);
  const [raiseAmount, setRaiseAmount] = useState(100);
  const [showRankings, setShowRankings] = useState(false);
  const canvasRef = useRef(null);

  // Fonction pour calculer la position visuelle d'un joueur basée sur les sièges
  const getVisualPosition = (playerSeat) => {
    if (mySeat === null) return 0;
    return (playerSeat - mySeat + 9) % 9;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      speed: Math.random() * 0.3 + 0.1,
      opacity: Math.random() * 0.4 + 0.1,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 180, 140, ${p.opacity})`;
        ctx.fill();
        p.y -= p.speed;
        if (p.y < -2) { p.y = canvas.height + 2; p.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const players   = gameState.players || [];
  const winners   = gameState.winners || [];
  const myInfo    = players.find(p => p.pseudo === myPseudo);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}
      className="min-h-screen bg-gradient-to-b from-[#1a3a2a] via-[#0f2818] to-[#0a1f12] text-white flex flex-col overflow-hidden relative">

      {/* BACKGROUND CANVAS */}
      <canvas ref={canvasRef} 
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }} />

      {/* RANKS PANEL */}
      <AnimatePresence>
      {showRankings && (
          <motion.div
            initial={{ x: -380 }} animate={{ x: 0 }} exit={{ x: -380 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="absolute top-0 left-0 h-full w-72 z-50 overflow-y-auto"
            style={{ background: '#090909', borderRight: '1px solid #1e1810' }}>
            <div className="flex justify-between items-center p-6 mb-2" style={{ borderBottom: '1px solid #1a1610' }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.1rem', color: '#d4b870' }}>
                Hiérarchie des mains
              </span>
              <button onClick={() => setShowRankings(false)} className="p-1.5 hover:bg-white/5 rounded transition-colors">
                <X size={16} className="text-white/40" />
              </button>
            </div>
            <div className="flex flex-col px-4 pb-6 gap-2">
              {POKER_HANDS.map(h => (
                <div key={h.rank} className="flex items-center gap-3 p-3 rounded"
                  style={{ background: '#0f0e0b', border: '1px solid #1e1810' }}>
                  <span className="text-[10px] font-mono w-5 text-center" style={{ color: '#3a3020' }}>{h.rank}</span>
                  <div>
                    <p className="text-xs font-medium" style={{ color: h.color }}>{h.name}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#4a4030' }}>{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HEADER */}
      <header className="w-full flex justify-between items-center px-5 py-3 z-40"
        style={{ background: '#060606', borderBottom: '1px solid #141008' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/poker')}
            className="flex items-center gap-2 text-[11px] uppercase"
            style={{ color: '#4a4030', letterSpacing: '0.2em' }}
            onMouseEnter={e => e.currentTarget.style.color = '#d4b870'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a4030'}>
            <LogOut size={13} /> Tables
          </button>
          <div style={{ width: 1, height: 16, background: '#1e1810' }} />
          <button onClick={() => setShowRankings(true)}
            className="flex items-center gap-2 text-[11px] uppercase"
            style={{ color: '#4a4030', letterSpacing: '0.2em' }}
            onMouseEnter={e => e.currentTarget.style.color = '#d4b870'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a4030'}>
            <Info size={13} /> Guide
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase" style={{ color: '#3a3020', letterSpacing: '0.25em' }}>Pseudo</span>
            <span className="font-mono text-sm font-medium" style={{ color: '#d4b870' }}>
              {myPseudo ? myPseudo.split('_')[0] : 'Connexion...'}
            </span>
          </div>
          <div style={{ width: 1, height: 20, background: '#1e1810' }} />
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] uppercase" style={{ color: '#3a3020', letterSpacing: '0.25em' }}>Solde</span>
            <span className="font-mono text-sm font-medium" style={{ color: '#d4b870' }}>${myInfo?.chips || 0}</span>
          </div>
        </div>
      </header>

      {/* TABLE */}
      <main className="flex-1 w-full flex items-center justify-center relative p-6 md:p-14 z-10">
        <div className="relative w-full max-w-5xl aspect-[16/9] bg-cover bg-center rounded-[12rem]"
          style={{ backgroundImage: `url(${tableImage})`, border: '22px solid #1e0e06', boxShadow: '0 40px 120px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,220,100,0.04)' }}>

          {gameState.players.map((player) => {
            const visualPos = getVisualPosition(player.seat);
            const pos = SEAT_POSITIONS[visualPos];
            const isLocal = player.pseudo === myPseudo;
            const myCards = gameState.hole_cards?.[player.pseudo] || [];

            return (
              <React.Fragment key={player.pseudo}>

                {/* NOM DU JOUEUR (badge avec pseudo et chips) */}
                <div className="absolute z-20 px-2.5 py-1.5 rounded text-center shadow-2xl min-w-[72px] md:min-w-[84px]"
                  style={{
                    top: pos.badgeTop, left: pos.badgeLeft,
                    transform: 'translate(-50%, -50%)',
                    background: '#0a0a08',
                    border: gameState.current_turn_pseudo === player.pseudo 
                      ? `1px solid #a07828`
                      : '1px solid #1e1810',
                    boxShadow: gameState.current_turn_pseudo === player.pseudo 
                      ? '0 0 20px rgba(160,120,40,0.35)' 
                      : 'none',
                  }}>
                  <p className="text-[9px] md:text-[10px] font-medium truncate max-w-[72px]"
                    style={{ color: '#c8b888', letterSpacing: '0.05em' }}>
                    {player.pseudo ? player.pseudo.split('_')[0] : '---'}
                  </p>
                  <p className="text-[9px] md:text-[10px] font-mono" style={{ color: '#a07828' }}>
                    ${player.chips}
                  </p>
                  {isLocal && myCards.length > 0 && !player.has_folded && !winners.length && (
                    <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[7px] md:text-[8px] px-2 py-0.5 rounded whitespace-nowrap z-40 font-medium uppercase tracking-wider"
                      style={{ background: '#1a1400', color: '#a07828', border: '1px solid #3a2a00', letterSpacing: '0.1em' }}>
                      {player?.current_hand || "—"}
                    </div>
                  )}
                </div>

                <>
                  <div className="absolute z-20 flex gap-[2px] md:gap-1"
                    style={{ top: pos.cardTop, left: pos.cardLeft, transform: 'translate(-50%, -50%)' }}>
                    {isLocal ? (
                      <AnimatePresence>
                        {!winners.length && !player.has_folded && myCards.length > 0 ? (
                          myCards.map((card, i) => (
                            <motion.div key={i}
                              initial={{ opacity: 0, y: -8, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0 }}
                              className="w-8 h-12 md:w-[42px] md:h-[62px] rounded flex items-center justify-center text-sm md:text-xl shadow-xl"
                              style={{ background: '#fafaf8', border: '1.5px solid #d0ccc0' }}>
                              <span className={`font-bold ${card.includes('♥') || card.includes('♦') ? 'text-red-700' : 'text-slate-900'}`}>
                                {card}
                              </span>
                            </motion.div>
                          ))
                        ) : (
                          player.has_folded && !winners.length && (
                            <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded"
                              style={{ color: '#5a2020', background: 'rgba(0,0,0,0.6)', border: '1px solid #2a1010', letterSpacing: '0.15em' }}>
                              Passé
                            </span>
                          )
                        )}
                      </AnimatePresence>
                    ) : (
                      !player.has_folded && gameState.phase !== "WaitingForPlayers" && !winners.length && (
                        <>
                          {[0, 1].map(i => (
                            <div key={i} className="w-8 h-12 md:w-[42px] md:h-[62px] rounded shadow-md"
                              style={{
                                background: 'repeating-linear-gradient(45deg, #1a1208, #1a1208 2px, #0e0c06 2px, #0e0c06 4px)',
                                border: '1.5px solid #2a2010'
                              }} />
                          ))}
                        </>
                      )
                    )}
                  </div>

                  {/* MISE */}
                  <AnimatePresence>
                    {player.current_bet > 0 && !winners.length && (
                      <motion.div key={`bet-${player.pseudo}`} exit={{ scale: 0, opacity: 0 }}
                        className="absolute z-30"
                        style={{ top: pos.betTop, left: pos.betLeft, transform: 'translate(-50%, -50%)' }}>
                        <ChipStack amount={player.current_bet} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              </React.Fragment>
            );
          })}

          {/* CENTRE TABLE */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">

            {gameState.phase === "WaitingForPlayers" && (
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => sendAction("StartGame")}
                className="pointer-events-auto z-50 uppercase text-[11px] font-medium px-10 py-3.5"
                style={{ background: 'transparent', border: '1px solid #a07828', color: '#d4b870', letterSpacing: '0.25em', fontFamily: "'DM Sans', sans-serif" }}>
                Lancer la partie
              </motion.button>
            )}

            <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2">
              <AnimatePresence>
                {gameState.pot > 0 && winners.length === 0 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <ChipStack amount={gameState.pot} isPot />
                  </motion.div>
                )}
                {winners.length > 0 && winners.map((winner, winIdx) => {
                  const seatIdx = players.findIndex(p => p.pseudo === winner.pseudo);
                  const seat = SEAT_POSITIONS[seatIdx] || SEAT_POSITIONS[0];
                  return (
                    <motion.div key={`win-${winner.pseudo}`}
                      initial={{ scale: 1, x: 0, y: 0 }}
                      animate={{ x: (parseFloat(seat.cardLeft) - 50) * 8, y: (parseFloat(seat.cardTop) - 50) * 4, scale: 0.5, opacity: 0 }}
                      transition={{ duration: 1, ease: 'circIn', delay: winIdx * 0.1 }}
                      className="absolute">
                      <ChipStack amount={winner.amountWon} isPot />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {gameState.phase !== "WaitingForPlayers" && winners.length === 0 && (
              <div className="absolute top-[49%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1.5 md:gap-2">
                <AnimatePresence>
                  {gameState.community_cards?.map((card, i) => (
                    <motion.div key={i} initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                      className="w-[34px] h-[50px] md:w-[48px] md:h-[70px] rounded flex items-center justify-center text-lg md:text-2xl shadow-xl"
                      style={{ background: '#fafaf8', border: '1.5px solid #d0ccc0' }}>
                      <span className={card.includes('♥') || card.includes('♦') ? 'text-red-700' : 'text-slate-900'}>
                        {card}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            <AnimatePresence>
              {winners.length > 0 && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute z-50 flex flex-col items-center gap-3 px-8 py-5 rounded"
                  style={{ background: '#080806', border: '1px solid #a07828', boxShadow: '0 0 40px rgba(160,120,40,0.3)' }}>
                  <Trophy size={24} style={{ color: '#d4b870' }} />
                  <div className="text-center flex flex-col gap-1">
                    {winners.map(w => (
                      <p key={w.pseudo} className="text-sm font-medium uppercase"
                        style={{ color: '#d4b870', letterSpacing: '0.2em', fontFamily: "'DM Sans', sans-serif" }}>
                        {w.pseudo.split('_')[0]} &mdash; ${w.amountWon}
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full z-40 p-3 md:p-4" style={{ background: '#060606', borderTop: '1px solid #141008' }}>
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3">
          <ActionBtn onClick={() => sendAction("Fold")} variant="danger">Passer</ActionBtn>
          <ActionBtn onClick={() => sendAction("Check")} variant="neutral">Check</ActionBtn>
          <ActionBtn onClick={() => sendAction("Call")} variant="positive">Suivre</ActionBtn>
          <div className="flex items-center gap-3 px-4 py-2 rounded" style={{ background: '#0a0a08', border: '1px solid #1e1810' }}>
            <ChevronUp size={13} style={{ color: '#4a4030' }} />
            <input type="range" min="50" max={myInfo?.chips || 1000} step="50"
              value={raiseAmount} onChange={e => setRaiseAmount(Number(e.target.value))}
              className="w-20 md:w-28" style={{ accentColor: '#a07828' }} />
            <span className="font-mono text-xs font-medium min-w-[3rem]" style={{ color: '#a07828' }}>${raiseAmount}</span>
            <ActionBtn onClick={() => sendAction("Raise", { amount: raiseAmount })} variant="raise">Relancer</ActionBtn>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ActionBtn({ onClick, variant, children }) {
  const styles = {
    danger:   { bg: 'rgba(60,20,20,0.6)',  border: '#3a1010', color: '#9a3a3a', hover: { bg: '#4a1818', color: '#c05050' } },
    neutral:  { bg: 'rgba(20,20,16,0.8)',  border: '#1e1e18', color: '#5a5a48', hover: { bg: '#1e1e18', color: '#9a9a80' } },
    positive: { bg: 'rgba(10,30,20,0.8)',  border: '#0a2a18', color: '#2a7a4a', hover: { bg: '#0a2a18', color: '#3a9a5a' } },
    raise:    { bg: 'rgba(30,24,10,0.8)',  border: '#3a2a08', color: '#a07828', hover: { bg: '#3a2a08', color: '#d4b040' } },
  };
  const s = styles[variant];
  return (
    <button onClick={onClick}
      className="w-24 md:w-28 py-2.5 md:py-3 text-[10px] uppercase font-medium rounded transition-all"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color, fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.2em' }}
      onMouseEnter={e => { e.currentTarget.style.background = s.hover.bg; e.currentTarget.style.color = s.hover.color; }}
      onMouseLeave={e => { e.currentTarget.style.background = s.bg; e.currentTarget.style.color = s.color; }}>
      {children}
    </button>
  );
}