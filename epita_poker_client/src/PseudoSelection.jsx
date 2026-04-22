import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function PseudoSelection() {
  const navigate = useNavigate();
  const { tableId } = useParams();
  const [pseudo, setPseudo] = useState('');
  const [error, setError] = useState('');
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

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedPseudo = pseudo.trim();
    
    if (trimmedPseudo.length < 2) {
      setError('Le pseudo doit contenir au moins 2 caractères');
      return;
    }
    if (trimmedPseudo.length > 20) {
      setError('Le pseudo ne doit pas dépasser 20 caractères');
      return;
    }

    // Passer le pseudo en tant que paramètre d'état
    navigate(`/poker/table/${tableId}`, { state: { pseudo: trimmedPseudo } });
  };

  return (
    <div className="home-root">
      <canvas ref={canvasRef} className="home-canvas" />

      <div className="home-content">
        <div className="home-header">
          <div className="home-logo-line" />
          <span className="home-logo-text">PSEUDO</span>
          <div className="home-logo-line" />
        </div>

        <h1 className="home-title">Bienvenue</h1>
        <p className="home-subtitle">Choisissez votre pseudo</p>

        <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={pseudo}
              onChange={(e) => {
                setPseudo(e.target.value);
                setError('');
              }}
              placeholder="Entrez votre pseudo..."
              maxLength={20}
              autoFocus
              className="px-6 py-3 rounded bg-[#0f0f0f] border border-[#2a2218] text-white placeholder-[#5a5040] focus:outline-none focus:border-[#b49640] transition-colors"
              style={{ fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.05em' }}
            />
            <p style={{ fontSize: '0.75rem', color: '#5a5040', letterSpacing: '0.1em' }}>
              {pseudo.length}/20 caractères
            </p>
          </div>

          {error && (
            <p style={{ color: '#d45050', fontSize: '0.85rem', fontWeight: 500 }}>
              ⚠ {error}
            </p>
          )}

          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-8 py-3 rounded uppercase text-sm font-medium transition-all"
            style={{
              background: 'transparent',
              border: '1px solid #a07828',
              color: '#d4b870',
              letterSpacing: '0.2em',
              fontFamily: "'DM Sans', sans-serif",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(160, 120, 40, 0.1)';
              e.currentTarget.style.color = '#e6c980';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#d4b870';
            }}>
            Rejoindre <ArrowRight size={16} />
          </button>
        </form>

        <p className="home-footer-text" style={{ marginTop: '2rem' }}>
          Jouez de façon responsable · 18+
        </p>
      </div>
    </div>
  );
}
