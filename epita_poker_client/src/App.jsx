import { Routes, Route, useNavigate } from 'react-router-dom';
import PokerTable from './Poker_Table'; // Ton ancien App.jsx deviendra ça
import { Spade, Club } from 'lucide-react';

// LA PAGE D'ACCUEIL (Home)
function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold mb-2">EPITA<span className="text-emerald-500 font-light">Casino</span></h1>
      <p className="text-white/40 mb-12">Choisissez votre table</p>

      <div className="flex gap-8 w-full max-w-4xl">
        {/* Bouton Poker (Ton jeu) */}
        <button 
          onClick={() => navigate('/poker')}
          className="flex-1 group relative p-1 rounded-3xl bg-gradient-to-b from-emerald-500/50 to-transparent hover:from-emerald-400 transition-all duration-500"
        >
          <div className="bg-slate-950/90 h-80 rounded-[22px] flex flex-col items-center justify-center border border-white/5 group-hover:bg-slate-900/90 transition-colors">
            <Spade size={64} className="text-emerald-500 mb-6 group-hover:scale-110 transition-transform duration-500" />            <h2 className="text-3xl font-bold">Poker Texas Hold'em</h2>
            <p className="text-white/40 mt-2">Rejoindre la table 1</p>
          </div>
        </button>

        {/* Bouton Blackjack (Celui de ton collègue) */}
        <button 
          onClick={() => navigate('/blackjack')}
          className="flex-1 group relative p-1 rounded-3xl bg-gradient-to-b from-red-500/50 to-transparent hover:from-red-400 transition-all duration-500"
        >
          <div className="bg-slate-950/90 h-80 rounded-[22px] flex flex-col items-center justify-center border border-white/5 group-hover:bg-slate-900/90 transition-colors">
            <Club size={64} className="text-red-500 mb-6 group-hover:scale-110 transition-transform duration-500" />
            <h2 className="text-3xl font-bold">Blackjack 21</h2>
            <p className="text-white/40 mt-2">Bientôt disponible</p>
          </div>
        </button>
      </div>
    </div>
  );
}

// LE GESTIONNAIRE DE ROUTES
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/poker" element={<PokerTable />} />
      <Route path="/blackjack" element={<div className="text-white p-8 text-center text-2xl">Page Blackjack en construction par ton collègue...</div>} />
    </Routes>
  );
}