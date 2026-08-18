import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import '../styles/Public.css';

interface RifaPublica {
  id: string;
  titulo: string;
  cantidadBoletos: number;
  imagenUrl: string;
  fechaFin: string;
  estado?: string;
  precioBoleto?: number;
  ganadorEmail?: string;
  ganadorBoleto?: string;
}

export const Home: React.FC = () => {
  const [rifas, setRifas] = useState<RifaPublica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Conteo real de boletos vendidos/pendientes por rifa
  const [boletosCount, setBoletosCount] = useState<Record<string, number>>({});
  const boletosUnsubs = useRef<(() => void)[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, 'rifas'),
      where('estado', 'in', ['activa', 'finalizada'])
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rifasData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as RifaPublica[];

        setRifas(rifasData);
        setLoading(false);
      },
      (err) => {
        console.error('Error al cargar las rifas: ', err);
        setError('No pudimos cargar las rifas en este momento. Intenta de nuevo más tarde.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Listener en tiempo real para la subcoleccion de boletos de cada rifa
  useEffect(() => {
    boletosUnsubs.current.forEach(fn => fn());
    boletosUnsubs.current = [];

    rifas.forEach(rifa => {
      const unsub = onSnapshot(
        collection(db, 'rifas', rifa.id, 'boletos'),
        (snap) => {
          setBoletosCount(prev => ({ ...prev, [rifa.id]: snap.size }));
        }
      );
      boletosUnsubs.current.push(unsub);
    });

    return () => {
      boletosUnsubs.current.forEach(fn => fn());
    };
  }, [rifas]);

  const formatMoney = (amount: number = 0) => {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount);
  };

  return (
    <>
      {/* Background Overlays */}
      <div className="bg-grid-overlay"></div>
      <div className="bg-blob-cyan"></div>
      <div className="bg-blob-pink"></div>

      {/* Navbar */}
      <header className="site-header">
        <div className="header-container">
          <Link to="/" className="logo-link">
            Rifa<span style={{ color: 'var(--ze-red-bright)' }}>Tickets</span>
          </Link>

          <nav className="desktop-nav">
            <a href="#hero" className="ze-nav-link active">INICIO</a>
            <a href="#rifas" className="ze-nav-link">DINÁMICAS</a>
            <a href="#ganadores" className="ze-nav-link">GANADORES</a>
            <a href="#contacto" className="ze-nav-link">SOPORTE</a>

            <Link to="/verificador" className="ze-nav-cta">
              <i className="fa-solid fa-magnifying-glass"></i>
              <span>VERIFICAR NÚMERO</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section id="hero" className="hero-section">
        <div className="hero-particles">
          <div className="hero-particle blue" style={{ width: '40px', height: '40px', left: '10%', top: '20%', animationDuration: '12s', '--drift': '50px' } as any}></div>
          <div className="hero-particle red" style={{ width: '60px', height: '60px', left: '80%', top: '30%', animationDuration: '15s', '--drift': '-40px' } as any}></div>
          <div className="hero-particle green" style={{ width: '30px', height: '30px', left: '40%', top: '80%', animationDuration: '10s', '--drift': '20px' } as any}></div>
        </div>

        <div className="floating-icon" style={{ top: '15%', left: '5%' }}>
          <div className="icon-3d"><i className="fa-solid fa-car-side icon-car"></i></div>
        </div>
        <div className="floating-icon" style={{ top: '60%', right: '10%' }}>
          <div className="icon-3d"><i className="fa-solid fa-trophy icon-trophy" style={{ animationDelay: '1.5s' }}></i></div>
        </div>

        <div className="hero-content">
          <div className="ze-halo">
            <h1 className="hero-title-container">
              <span className="ze-headline-rojo">EL PRÓXIMO BENDECIDO</span>
              <span className="ze-headline-simple">PUEDES SER TÚ</span>
            </h1>
          </div>
          <div className="ze-separador" style={{ margin: '2rem auto' }}></div>

          <p className="mb-6" style={{ fontSize: '1.25rem', color: 'var(--ze-text-soft)', maxWidth: '42rem', margin: '0 auto 2rem' }}>
            Únete a la familia Rifa Tickets. Participa en nuestras dinámicas exclusivas y cambia tu vida hoy. Totalmente seguro y transparente.
          </p>

          <a href="#rifas" className="ze-nav-cta" style={{ fontSize: '1.125rem', padding: '1rem 2.5rem' }}>
            <i className="fa-solid fa-bolt text-yellow-400"></i>
            VER DINÁMICAS ACTIVAS
          </a>
        </div>
      </section>

      {/* Catalog Section */}
      <section id="rifas" className="catalog-section">
        <div className="catalog-header">
          <div>
            <h2 className="catalog-title">
              <span className="ze-headline-casino">DINÁMICAS</span> ACTIVAS
            </h2>
            <p style={{ color: 'var(--ze-text-muted)' }}>Elige tu dinámica y asegura tus oportunidades</p>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--ze-cyan)' }}>
            <i className="fa-solid fa-circle-notch fa-spin fa-3x"></i>
            <p className="mt-4">Cargando dinámicas...</p>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--ze-red)' }}>
            <i className="fa-solid fa-triangle-exclamation fa-3x"></i>
            <p className="mt-4">{error}</p>
          </div>
        ) : (
          <div className="rifas-grid">
            {rifas.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem 0', color: 'var(--ze-text-muted)' }}>
                <i className="fa-solid fa-box-open fa-3x mb-4"></i>
                <p>No hay dinámicas activas en este momento. Vuelve pronto.</p>
              </div>
            ) : (
              rifas.map(rifa => {
                const vendidos = boletosCount[rifa.id] || 0;
                const progress = rifa.cantidadBoletos > 0
                  ? Math.round((vendidos / rifa.cantidadBoletos) * 100)
                  : 0;
                const isFinalizada = rifa.estado === 'finalizada';

                return (
                  <article key={rifa.id} className="raffle-card" style={isFinalizada ? { opacity: 0.85 } : {}}>
                    {/* Badge */}
                    <div className="ze-badge-gold" style={isFinalizada ? { background: '#4b5563', color: 'white' } : {}}>
                      {isFinalizada ? <><i className="fa-solid fa-lock"></i> CERRADA</> : <><i className="fa-solid fa-crown"></i> PREMIUM</>}
                    </div>

                    {/* Image */}
                    <div className="card-img-container">
                      <img src={rifa.imagenUrl} alt={rifa.titulo} className="card-img" style={isFinalizada ? { filter: 'grayscale(100%)' } : {}} />
                      <div className="card-img-overlay"></div>
                    </div>

                    {/* Content */}
                    <div className="card-content">
                      <h3 className="card-title">{rifa.titulo}</h3>
                      <p className="card-desc">
                        {isFinalizada ? 'Esta dinámica ya ha finalizado y tiene un ganador.' : 'Oportunidad única para ganar esta dinámica. ¡No te quedes sin tus boletos!'}
                      </p>

                      <div className="card-date">
                        <i className={isFinalizada ? "fa-solid fa-lock" : "fa-regular fa-clock"}></i>
                        <span>{isFinalizada ? 'Rifa cerrada' : `Cierra: ${rifa.fechaFin}`}</span>
                      </div>

                      {/* Progress bar */}
                      <div className="progress-container">
                        <div className="progress-header">
                          <span>{isFinalizada ? 'YA SE HA ELEGIDO UN GANADOR' : `VENDIDOS: ${vendidos}/${rifa.cantidadBoletos}`}</span>
                          {!isFinalizada && <span>{progress}%</span>}
                        </div>
                        {!isFinalizada && (
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="card-footer">
                        <div>
                          <p className="price-tag">{formatMoney(rifa.precioBoleto || 100)}</p>
                          <p className="min-tickets">Total Boletos: {rifa.cantidadBoletos}</p>
                        </div>
                        {isFinalizada ? (
                          <span className="ze-btn-jugar" style={{ background: '#4b5563', color: '#9ca3af', cursor: 'not-allowed', boxShadow: 'none' }}>
                            <i className="fa-solid fa-lock mr-2" style={{ marginRight: '0.5rem' }}></i> CERRADO
                          </span>
                        ) : (
                          <Link to={`/rifa/${rifa.id}`} className="ze-btn-jugar">
                            <i className="fa-solid fa-ticket mr-2" style={{ marginRight: '0.5rem' }}></i> JUGAR
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Ganadores Recientes */}
      <section id="ganadores" className="winners-section">
        <div className="ze-separador" style={{ marginBottom: '3rem' }}></div>

        <div className="catalog-header">
          <div>
            <h2 className="catalog-title">
              <span className="ze-headline-casino">GANADORES</span> RECIENTES
            </h2>
            <p style={{ color: 'var(--ze-text-muted)' }}>Historias reales de quienes ya cambiaron su vida</p>
          </div>
        </div>

        {rifas.filter(r => r.estado === 'finalizada').length === 0 ? (
          <div className="winners-empty">
            <div className="winners-empty-icon">
              <i className="fa-solid fa-trophy"></i>
            </div>
            <p className="winners-empty-text">Próximamente se anunciarán los primeros ganadores...</p>
            <p className="winners-empty-sub">Participa en nuestras dinámicas activas y podrías ser el primero en aparecer aquí.</p>
          </div>
        ) : (
          <div className="rifas-grid">
            {rifas.filter(r => r.estado === 'finalizada').map(rifa => (
              <article key={rifa.id} className="raffle-card" style={{ border: '2px solid var(--ze-yellow)', overflow: 'hidden' }}>
                <div style={{ background: 'var(--ze-yellow)', color: 'black', padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  <i className="fa-solid fa-trophy"></i> ¡GANADOR ELEGIDO!
                </div>
                <div className="card-img-container" style={{ height: '220px' }}>
                  <img src={rifa.imagenUrl} alt={rifa.titulo} className="card-img" />
                </div>
                <div className="card-content">
                  <h3 className="card-title">{rifa.titulo}</h3>
                  <div style={{ marginTop: '1rem', padding: '1.5rem', background: 'rgba(255,215,0,0.05)', borderRadius: '12px', border: '1px solid rgba(255,215,0,0.2)' }}>
                    <p style={{ color: 'var(--ze-yellow)', fontWeight: 'bold', marginBottom: '0.5rem', fontSize: '1.2rem', textAlign: 'center' }}>Boleto Ganador: #{rifa.ganadorBoleto}</p>
                    <p style={{ color: 'var(--ze-text)', wordBreak: 'break-all', textAlign: 'center', fontSize: '1.1rem' }}>{rifa.ganadorEmail}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
};
