import { useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { LogOut } from 'lucide-react';

export default function PokerTableSelection() {
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

  const tables = [
    { id: 'table1', name: 'Table 1', players: '3/9', stakes: '$5 - $25' },
    { id: 'table2', name: 'Table 2', players: '1/9', stakes: '$10 - $50' },
    { id: 'table3', name: 'Table 3', players: '6/9', stakes: '$25 - $100' },
    { id: 'table4', name: 'Table 4', players: '4/9', stakes: '$50 - $200' },
    { id: 'table5', name: 'Table 5', players: '2/9', stakes: '$5 - $25' },
    { id: 'table6', name: 'Table 6', players: '8/9', stakes: '$10 - $50' },
  ];

  return (
    <div className="home-root">
      <canvas ref={canvasRef} className="home-canvas" />

      <div className="home-content" style={{ maxWidth: '100%', paddingBottom: '2rem' }}>
        <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 50 }}>
          <button onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[11px] uppercase"
            style={{ color: '#4a4030', letterSpacing: '0.2em' }}
            onMouseEnter={e => e.currentTarget.style.color = '#d4b870'}
            onMouseLeave={e => e.currentTarget.style.color = '#4a4030'}>
            <LogOut size={13} /> Retour
          </button>
        </div>

        <div className="home-header">
          <div className="home-logo-line" />
          <span className="home-logo-text">TABLES</span>
          <div className="home-logo-line" />
        </div>

        <h1 className="home-title">Texas Hold'em</h1>
        <p className="home-subtitle">Sélectionnez votre table</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
          width: '100%',
          maxWidth: '1000px',
          padding: '0 1rem',
        }}>
          {tables.map(table => (
            <button
              key={table.id}
              onClick={() => navigate(`/poker/table/${table.id}/pseudo`)}
              className="game-card poker-card"
              style={{ height: '180px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div className="card-suit">♠</div>
                <div className="card-info">
                  <h2 className="card-name">{table.name}</h2>
                  <p className="card-sub">{table.stakes}</p>
                </div>
              </div>
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                alignItems: 'center',
                padding: '1rem 0 0 0',
                borderTop: '1px solid #1e1810',
                width: '100%',
              }}>
                <p style={{ fontSize: '0.85rem', color: '#a07828', fontWeight: 600 }}>
                  {table.players} joueurs
                </p>
              </div>
              <div className="card-glow poker-glow" />
            </button>
          ))}
        </div>

        <p className="home-footer-text" style={{ marginTop: '2rem' }}>
          Jouez de façon responsable · 18+
        </p>
      </div>
    </div>
  );
}
