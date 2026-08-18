import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Link } from 'react-router-dom';
import '../styles/Public.css';

interface RifaOption {
  id: string;
  titulo: string;
}

interface BoletoResult {
  numero: string;
  compradorNombre: string;
  fechaReserva: string;
}

export const Verificador: React.FC = () => {
  const [rifas, setRifas] = useState<RifaOption[]>([]);
  const [selectedRifa, setSelectedRifa] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [resultado, setResultado] = useState<BoletoResult | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [buscado, setBuscado] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'rifas'), where('estado', '==', 'activa'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({
        id: d.id,
        titulo: d.data().titulo
      }));
      setRifas(data);
    });
    return () => unsubscribe();
  }, []);

  const buscarBoleto = async () => {
    if (!selectedRifa) {
      setMensajeError('Selecciona una dinámica primero.');
      return;
    }
    const trimmed = searchInput.trim();
    if (!trimmed) {
      setMensajeError('Ingresa un número de boleto.');
      return;
    }

    setMensajeError('');
    setResultado(null);
    setBuscando(true);
    setBuscado(true);

    try {
      const boletoRef = doc(db, 'rifas', selectedRifa, 'boletos', trimmed);
      const boletoSnap = await getDoc(boletoRef);

      if (!boletoSnap.exists()) {
        setResultado(null);
      } else {
        const data = boletoSnap.data();
        let nameToDisplay = data.compradorNombre || data.compradorEmail || 'No registrado';

        if (data.compradorEmail && !data.compradorNombre) {
          try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', data.compradorEmail));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              nameToDisplay = querySnapshot.docs[0].data().name;
            }
          } catch (err) {
            console.error('Error al buscar usuario:', err);
          }
        }

        setResultado({
          numero: trimmed,
          compradorNombre: nameToDisplay,
          fechaReserva: data.fechaReserva || ''
        });
      }
    } catch (err) {
      console.error('Error al buscar boleto:', err);
      setMensajeError('Ocurrió un error al buscar. Intenta de nuevo.');
    } finally {
      setBuscando(false);
    }
  };

  const formatFecha = (iso: string) => {
    if (!iso) return 'Sin fecha';
    const date = new Date(iso);
    return date.toLocaleString('es-DO', {
      day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  };

  return (
    <>
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
            <Link to="/" className="ze-nav-link">INICIO</Link>
            <Link to="/verificador" className="ze-nav-link active">VERIFICADOR</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="verificador-hero">
        <div className="verificador-hero-content">
          <div style={{ marginBottom: '1.5rem' }}>
            <i className="fa-solid fa-magnifying-glass verificador-hero-icon"></i>
          </div>
          <h1 className="verificador-title orbitron">VERIFICADOR</h1>
          <h2 className="verificador-subtitle orbitron">DE NÚMEROS</h2>
          <p className="verificador-desc">
            Ingresa tu número de boleto para consultar quién lo reservó
          </p>

          {/* Search Card */}
          <div className="verificador-card">
            {/* Paso 1 */}
            <div className="verificador-step">
              <div style={{ textAlign: 'left' }}>
                <span className="step-badge step-1">Paso 1 de 2</span>
              </div>
              <label className="verificador-label">
                <i className="fa-solid fa-filter" style={{ marginRight: '0.5rem', color: 'var(--ze-blue-bright)' }}></i>
                Selecciona la Dinámica
              </label>
              <select
                className="verificador-select"
                value={selectedRifa}
                onChange={(e) => { setSelectedRifa(e.target.value); setMensajeError(''); }}
              >
                <option value="" disabled hidden>Elige una dinámica</option>
                {rifas.map(r => (
                  <option key={r.id} value={r.id}>{r.titulo}</option>
                ))}
              </select>
            </div>

            {/* Paso 2 */}
            {selectedRifa && (
              <div className="verificador-step" style={{ marginTop: '1.5rem' }}>
                <div style={{ textAlign: 'left' }}>
                  <span className="step-badge step-2">Paso 2 de 2</span>
                </div>
                <label className="verificador-label">
                  <i className="fa-solid fa-ticket" style={{ marginRight: '0.5rem', color: 'var(--ze-red-bright)' }}></i>
                  Número de Boleto
                </label>
                <div className="verificador-search-row">
                  <input
                    type="text"
                    className="verificador-input"
                    placeholder="Ej: 1, 25, 100..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') buscarBoleto(); }}
                  />
                  <button className="ze-btn-jugar" onClick={buscarBoleto} disabled={buscando}>
                    <i className="fa-solid fa-magnifying-glass" style={{ marginRight: '0.5rem' }}></i>
                    {buscando ? 'BUSCANDO...' : 'BUSCAR'}
                  </button>
                </div>
                <p className="verificador-hint">
                  <i className="fa-solid fa-circle-info" style={{ marginRight: '0.375rem' }}></i>
                  Ingresa el número de boleto que deseas verificar
                </p>
              </div>
            )}

            {mensajeError && (
              <div className="verificador-error">
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '0.5rem' }}></i>
                {mensajeError}
              </div>
            )}
          </div>

          {/* Resultados */}
          {buscado && !buscando && (
            <div className="verificador-results">
              {resultado ? (
                <div className="verificador-result-card">
                  <div className="result-header">
                    <i className="fa-solid fa-circle-check" style={{ color: 'var(--ze-green)', marginRight: '0.5rem' }}></i>
                    Boleto #{resultado.numero} — Reservado
                  </div>
                  <div className="result-body">
                    <div className="result-row">
                      <span className="result-label">
                        <i className="fa-solid fa-user"></i> Comprador
                      </span>
                      <span className="result-value">{resultado.compradorNombre}</span>
                    </div>
                    <div className="result-row">
                      <span className="result-label">
                        <i className="fa-regular fa-calendar"></i> Fecha y Hora
                      </span>
                      <span className="result-value">{formatFecha(resultado.fechaReserva)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="verificador-no-result">
                  <i className="fa-solid fa-circle-xmark" style={{ fontSize: '2rem', color: 'var(--ze-text-muted)', marginBottom: '0.75rem' }}></i>
                  <p className="orbitron" style={{ color: 'var(--ze-text-soft)', marginBottom: '0.25rem' }}>
                    Boleto no encontrado
                  </p>
                  <p style={{ color: 'var(--ze-text-muted)', fontSize: '0.875rem' }}>
                    Este número aún no ha sido reservado o no existe en esta dinámica.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  );
};
