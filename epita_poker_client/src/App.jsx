import { Routes, Route, useNavigate } from 'react-router-dom';
import PokerTable from './Poker_Table';
import PokerTableSelection from './PokerTableSelection';
import PseudoSelection from './PseudoSelection';
import { useEffect, useRef } from 'react';

function Home() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);

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
        ctx.fillStyle = `rgba(180, 150, 80, ${p.opacity})`;
        ctx.fill();
        p.y -= p.speed;
        if (p.y < -2) { p.y = canvas.height + 2; p.x = Math.random() * canvas.width; }
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="home-root">
      <canvas ref={canvasRef} className="home-canvas" />

      <div className="home-content">
        <div className="home-header">
          <div className="home-logo-line" />
          <span className="home-logo-text">EPITA</span>
          <div className="home-logo-line" />
        </div>

        <h1 className="home-title">Casino Royale</h1>
        <p className="home-subtitle">Choisissez votre jeu</p>

        <div className="home-cards">
          {/* POKER */}
          <button className="game-card poker-card" onClick={() => navigate('/poker')}>
            <div className="card-suit">♠</div>
            <div className="card-info">
              <h2 className="card-name">Texas Hold'em</h2>
              <p className="card-sub">Multiples tables disponibles</p>
            </div>
            <div className="card-arrow">→</div>
            <div className="card-glow poker-glow" />
          </button>

          {/* BLACKJACK */}
          <button className="game-card blackjack-card disabled-card" disabled>
            <div className="card-suit red-suit">♣</div>
            <div className="card-info">
              <h2 className="card-name">Blackjack 21</h2>
              <p className="card-sub">Bientôt disponible</p>
            </div>
            <div className="card-badge">Prochainement</div>
            <div className="card-glow blackjack-glow" />
          </button>
        </div>

        <p className="home-footer-text">Jouez de façon responsable · 18+</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/poker" element={<PokerTableSelection />} />
      <Route path="/poker/table/:tableId/pseudo" element={<PseudoSelection />} />
      <Route path="/poker/table/:tableId" element={<PokerTable />} />
      <Route path="/blackjack" element={<div style={{color:'#fff',padding:'2rem',textAlign:'center',fontSize:'1.5rem'}}>Blackjack — En construction</div>} />
    </Routes>
  );
}
