import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePokerWebSocket } from './usePokerWebSocket';
import { Coins, Info, X, LogOut, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- COMPOSANT : CHAISE EN CUIR MARRON ---
const RealisticChair = ({ angle }) => (
  <div className="absolute -z-10 w-16 h-16 md:w-20 md:h-20" style={{ transform: `translate(-50%, -50%) rotate(${angle}deg)`, top: '50%', left: '50%' }}>
    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-6 md:w-18 md:h-8 bg-gradient-to-b from-[#5c3a21] to-[#361f0f] rounded-t-full shadow-[0_5px_15px_rgba(0,0,0,0.8)] border-2 border-[#2a1708]"></div>
    <div className="absolute top-4 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-b from-[#8b5a2b] to-[#5c3a21] rounded-b-xl shadow-[inset_0_4px_10px_rgba(0,0,0,0.6)] border border-[#3a2110] z-10"></div>
    <div className="absolute top-2 left-1 md:left-2 w-3 h-10 md:w-4 md:h-12 bg-gradient-to-b from-[#6b4423] to-[#3a2110] rounded-full shadow-lg border border-[#2a1708] z-20"></div>
    <div className="absolute top-2 right-1 md:right-2 w-3 h-10 md:w-4 md:h-12 bg-gradient-to-b from-[#6b4423] to-[#3a2110] rounded-full shadow-lg border border-[#2a1708] z-20"></div>
  </div>
);

// --- COMPOSANT : PILE DE JETONS ---
const ChipStack = ({ amount, isPot = false, delay = 0 }) => {
  if (amount <= 0) return null;
  const chipCount = Math.min(Math.max(Math.ceil(amount / 100), 1), 8);
  
  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={{ delay }}
      className={`relative flex flex-col items-center justify-end ${isPot ? 'w-20 h-20' : 'w-14 h-14'}`}
    >
      <div className="relative w-full h-full flex justify-center">
        {[...Array(chipCount)].map((_, i) => (
          <div key={i} className={`absolute w-8 h-4 md:w-10 md:h-5 rounded-[50%] border-2 border-dashed border-white/30 shadow-xl ${isPot ? 'bg-amber-600' : 'bg-blue-600'}`} style={{ bottom: `${i * 3}px`, zIndex: i }}>
            <div className={`absolute inset-0 rounded-[50%] translate-y-[2px] -z-10 ${isPot ? 'bg-amber-900' : 'bg-blue-900'}`}></div>
          </div>
        ))}
      </div>
      <span className="bg-black/90 px-2 py-0.5 rounded-full text-[10px] text-white font-mono font-bold mt-1 border border-white/20 z-10 shadow-lg">
        ${amount}
      </span>
    </motion.div>
  );
};

export default function PokerTable() {
  const navigate = useNavigate();
  const { isConnected, gameState, sendAction, myPseudo } = usePokerWebSocket('ws://127.0.0.1:3000/ws/table1');
  
  const [raiseAmount, setRaiseAmount] = useState(100);
  const [showRankings, setShowRankings] = useState(false);

  const players = gameState.players || [];
  const opponents = players.filter(p => p.pseudo !== myPseudo);
  const myPlayerInfo = players.find(p => p.pseudo === myPseudo);
  const myCards = gameState.hole_cards?.[myPseudo] || [];
  const winners = gameState.winners || [];

  // --- CONFIGURATION 9-MAX ---
  // On enlève le siège "Haut Centre" et on réajuste "Haut Gauche" et "Haut Droite" (à 31% et 69%)
  const SEAT_POSITIONS = [
    { chairTop: '110%', chairLeft: '50%', angle: 180, cardTop: '90%', cardLeft: '50%' }, // 0: Toi (Bas Centre)
    { chairTop: '110%', chairLeft: '23%', angle: 180, cardTop: '90%', cardLeft: '23%' }, // 1: Bas Gauche
    { chairTop: '70%', chairLeft: '-5%', angle: 270, cardTop: '65%', cardLeft: '11%' }, // 2: Gauche Bas
    { chairTop: '30%', chairLeft: '-5%', angle: 270, cardTop: '35%', cardLeft: '11%' }, // 3: Gauche Haut
    { chairTop: '-10%',  chairLeft: '31%', angle: 0,   cardTop: '10%', cardLeft: '31%' }, // 4: Haut Gauche (réajusté)
    { chairTop: '-10%',  chairLeft: '69%', angle: 0,   cardTop: '10%', cardLeft: '69%' }, // 5: Haut Droite (réajusté)
    { chairTop: '30%', chairLeft: '105%',angle: 90,  cardTop: '35%', cardLeft: '89%' }, // 6: Droite Haut
    { chairTop: '70%', chairLeft: '105%',angle: 90,  cardTop: '65%', cardLeft: '89%' }, // 7: Droite Bas
    { chairTop: '110%', chairLeft: '77%', angle: 180, cardTop: '90%', cardLeft: '77%' }, // 8: Bas Droite
  ];

  const pokerHands = [
    { name: "Quinte Flush Royale", desc: "10, J, Q, K, A de la même couleur.", color: "text-amber-400" },
    { name: "Quinte Flush", desc: "5 cartes de même couleur qui se suivent.", color: "text-amber-500" },
    { name: "Carré", desc: "4 cartes de même valeur.", color: "text-orange-400" },
    { name: "Full House", desc: "Un brelan + une paire.", color: "text-orange-500" },
    { name: "Couleur (Flush)", desc: "5 cartes de la même couleur.", color: "text-rose-400" },
    { name: "Quinte (Suite)", desc: "5 cartes qui se suivent.", color: "text-emerald-400" },
    { name: "Brelan", desc: "3 cartes de même valeur.", color: "text-cyan-400" },
    { name: "Double Paire", desc: "Deux paires de cartes.", color: "text-blue-400" },
    { name: "Paire", desc: "2 cartes de même valeur.", color: "text-indigo-400" },
    { name: "Carte Haute", desc: "La carte la plus forte.", color: "text-slate-400" },
  ];

  return (
    <div className="min-h-screen bg-[#111] text-white flex flex-col font-sans overflow-hidden relative">
      <AnimatePresence>
        {showRankings && (
          <motion.div initial={{ x: -400 }} animate={{ x: 0 }} exit={{ x: -400 }} className="absolute top-0 left-0 h-full w-72 bg-slate-900/95 backdrop-blur-xl border-r border-white/10 z-50 p-6 shadow-2xl overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Mains de Poker</h2>
              <button onClick={() => setShowRankings(false)} className="p-1 hover:bg-white/10 rounded"><X size={20}/></button>
            </div>
            <div className="flex flex-col gap-3">
              {pokerHands.map((h, i) => (
                <div key={i} className="bg-black/40 p-3 rounded-lg border border-white/5">
                  <p className={`text-xs font-bold ${h.color}`}>{i+1}. {h.name}</p>
                  <p className="text-[10px] text-white/40 mt-1">{h.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="w-full flex justify-between items-center px-6 py-3 bg-black/50 border-b border-white/10 z-40">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm"><LogOut size={16}/> Quitter</button>
          <button onClick={() => setShowRankings(true)} className="flex items-center gap-2 px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded-full text-xs font-bold border border-indigo-500/30 transition-colors">
            <Info size={14}/> Aide / Mains
          </button>
        </div>
        <div className="bg-slate-800 px-4 py-1.5 rounded-full text-emerald-400 font-mono text-sm border border-slate-700">
            <Coins size={14} className="inline mr-2"/> ${myPlayerInfo?.chips || 0}
        </div>
      </header>

      <main className="flex-1 w-full flex items-center justify-center relative p-8 md:p-16">
        
        {/* LA TABLE */}
        <div className="relative w-full max-w-5xl aspect-[16/9] bg-[url('/nouvelle_table.jpg')] bg-cover bg-center bg-no-repeat border-[24px] border-[#4A1A14] rounded-[12rem] shadow-[0_30px_100px_rgba(0,0,0,0.9)] flex items-center justify-center">
          
          {/* SIÈGES ET JOUEURS */}
          {SEAT_POSITIONS.map((pos, idx) => {
            const isLocal = idx === 0;
            const player = isLocal ? myPlayerInfo : opponents[idx - 1];
            const isTopSeat = parseInt(pos.cardTop) < 50;
            
            return (
              <React.Fragment key={idx}>
                
                {/* LA CHAISE */}
                <div className="absolute z-10" style={{ top: pos.chairTop, left: pos.chairLeft, transform: 'translate(-50%, -50%)' }}>
                  <RealisticChair angle={pos.angle} />
                </div>
                
                {/* LES CARTES ET INFOS */}
                {player && (
                  <div className="absolute z-20 flex justify-center items-center flex-col" style={{ top: pos.cardTop, left: pos.cardLeft, transform: 'translate(-50%, -50%)' }}>
                    
                    {/* CARTES DU JOUEUR (Parfaitement droites) */}
                    <div className={`flex gap-[2px] md:gap-[4px] z-10 ${isTopSeat ? 'order-2 mt-2' : 'order-1 mb-2'}`}>
                      {isLocal ? (
                        <AnimatePresence>
                          {!winners.length && !player.has_folded && myCards.length > 0 ? (
                            myCards.map((card, i) => (
                              <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="w-8 h-12 md:w-[42px] md:h-[62px] bg-white rounded flex items-center justify-center text-sm md:text-xl border-2 border-slate-200 shadow-sm text-slate-900">
                                <span className={`font-bold ${card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-slate-900'}`}>{card}</span>
                              </motion.div>
                            ))
                          ) : (
                            player.has_folded && !winners.length && (
                              <span className="text-red-500 font-black uppercase text-[10px] md:text-xs italic bg-black/50 px-2 py-1 rounded">Foldé</span>
                            )
                          )}
                        </AnimatePresence>
                      ) : (
                        !player.has_folded && gameState.phase !== "WaitingForPlayers" && !winners.length && (
                          <>
                            <div className="w-8 h-12 md:w-[42px] md:h-[62px] bg-white border border-slate-400 rounded shadow-sm bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_2px,#ffffff_2px,#ffffff_4px)]"></div>
                            <div className="w-8 h-12 md:w-[42px] md:h-[62px] bg-white border border-slate-400 rounded shadow-sm bg-[repeating-linear-gradient(45deg,#e2e8f0,#e2e8f0_2px,#ffffff_2px,#ffffff_4px)]"></div>
                          </>
                        )
                      )}
                    </div>

                    {/* INFOS DU JOUEUR */}
                    <div className={`absolute ${isTopSeat ? 'bottom-full mb-2' : 'top-full mt-2'} bg-slate-900 border-2 ${gameState.current_turn_pseudo === player.pseudo ? 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.8)]' : 'border-slate-700'} px-2 md:px-3 py-1 rounded-lg text-center shadow-xl min-w-[70px] md:min-w-[80px] z-20`}>
                      <p className="text-[9px] md:text-[10px] font-bold text-white truncate max-w-[70px]">{player.pseudo.split('_')[0]}</p>
                      <p className="text-[9px] md:text-[10px] text-amber-400">${player.chips}</p>
                      
                      {/* Badge Analyse de Main (Local) */}
                      {isLocal && myCards.length > 0 && !player.has_folded && !winners.length && (
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-indigo-600 text-[7px] md:text-[8px] px-2 py-0.5 rounded-full border border-indigo-400 shadow-lg font-bold uppercase whitespace-nowrap z-40">
                          {player?.current_hand || "Analyse..."}
                        </div>
                      )}
                    </div>

                    {/* MISE DU TOUR EN COURS */}
                    <AnimatePresence>
                      {player.current_bet > 0 && !winners.length && (
                        <motion.div 
                          key={`bet-${player.pseudo}`}
                          exit={{ scale: 0, opacity: 0 }}
                          className={`absolute ${isTopSeat ? 'top-full mt-8 md:mt-10' : 'bottom-full mb-8 md:mb-10'} z-30`}
                        >
                          <ChipStack amount={player.current_bet} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* ZONE CENTRALE */}
          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center z-10 pointer-events-none">
            
            {/* BOUTON LANCER LA PARTIE */}
            {gameState.phase === "WaitingForPlayers" && (
              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => sendAction("StartGame")} className="pointer-events-auto absolute px-8 py-3 bg-gradient-to-b from-amber-400 to-amber-600 text-slate-900 rounded-full font-black text-sm shadow-[0_0_40px_rgba(245,158,11,0.4)] uppercase tracking-tighter border-2 border-amber-200 z-50">
                Lancer la partie
              </motion.button>
            )}

            {/* LE POT CENTRAL */}
            <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex justify-center items-center">
              <AnimatePresence>
                {gameState.pot > 0 && winners.length === 0 && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <ChipStack amount={gameState.pot} isPot={true} />
                  </motion.div>
                )}

                {winners.length > 0 && winners.map((winner, winIdx) => {
                  const winnerSeatIdx = players.findIndex(p => p.pseudo === winner.pseudo);
                  const seat = SEAT_POSITIONS[winnerSeatIdx] || SEAT_POSITIONS[0];
                  return (
                    <motion.div
                      key={`win-stack-${winner.pseudo}`}
                      initial={{ scale: 1, x: 0, y: 0 }}
                      animate={{ x: (parseFloat(seat.cardLeft) - 50) * 8, y: (parseFloat(seat.cardTop) - 50) * 4, scale: 0.5, opacity: 0 }}
                      transition={{ duration: 1, ease: "circIn", delay: winIdx * 0.1 }}
                      className="absolute"
                    >
                      <ChipStack amount={winner.amountWon} isPot={true} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* CARTES COMMUNES */}
            {gameState.phase !== "WaitingForPlayers" && winners.length === 0 && (
              <div className="absolute top-[49%] md:top-[49.5%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-[0.4rem] md:gap-[0.6rem]">
                <AnimatePresence>
                  {gameState.community_cards?.map((card, i) => (
                    <motion.div key={i} initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-[34px] h-[50px] md:w-[48px] md:h-[70px] bg-white rounded flex items-center justify-center text-lg md:text-2xl border-2 border-slate-300 shadow-sm">
                      <span className={card.includes('♥') || card.includes('♦') ? 'text-red-600' : 'text-slate-900'}>{card}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            
            {/* GAGNANTS */}
            <AnimatePresence>
              {winners.length > 0 && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute z-50 flex flex-col items-center gap-2 bg-black/90 px-8 py-4 rounded-2xl border border-amber-500 shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                  <Trophy className="text-amber-500" size={32} />
                  <div className="text-center">
                    {winners.map(w => (
                      <p key={w.pseudo} className="text-sm font-black text-white uppercase tracking-tighter">
                        {w.pseudo.split('_')[0]} gagne ${w.amountWon} !
                      </p>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer className="w-full bg-black/80 border-t border-white/10 p-3 md:p-4 flex justify-center z-40">
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3">
          <button onClick={() => sendAction("Fold")} className="w-24 md:w-32 py-2 md:py-3 bg-red-900/40 hover:bg-red-800 rounded-lg font-bold text-xs uppercase border border-red-900 transition-all">Passer</button>
          <button onClick={() => sendAction("Check")} className="w-24 md:w-32 py-2 md:py-3 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold text-xs uppercase border border-slate-600 transition-all">Check</button>
          <button onClick={() => sendAction("Call")} className="w-24 md:w-32 py-2 md:py-3 bg-emerald-700 hover:bg-emerald-600 rounded-lg font-bold text-xs uppercase border border-emerald-500 transition-all">Suivre</button>
          <div className="flex items-center gap-2 md:gap-3 bg-slate-900 px-3 md:px-4 py-1.5 md:py-2 rounded-lg border border-slate-700">
            <input type="range" min="50" max={myPlayerInfo?.chips || 1000} step="50" value={raiseAmount} onChange={(e)=>setRaiseAmount(Number(e.target.value))} className="accent-amber-500 w-20 md:w-32" />
            <span className="text-amber-500 font-bold font-mono min-w-[3rem] text-xs md:text-sm">${raiseAmount}</span>
            <button onClick={() => sendAction("Raise", { amount: raiseAmount })} className="px-3 md:px-4 py-1.5 md:py-2 bg-amber-500 text-slate-900 rounded font-black text-[10px] md:text-xs uppercase hover:bg-amber-400 transition-all">Relancer</button>
          </div>
        </div>
      </footer>
    </div>
  );
}