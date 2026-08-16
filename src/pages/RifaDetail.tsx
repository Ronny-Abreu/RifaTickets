import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../config/firebase';
import '../styles/RifaDetail.css';
import '../styles/Auth.css';

interface Boleto {
  id: string;
  estado: 'pendiente' | 'comprado';
  compradorEmail?: string;
  voucherUrl?: string;
}

export const RifaDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [rifa, setRifa] = useState<any>(null);
  const [boletosReservados, setBoletosReservados] = useState<Record<string, Boleto>>({});

  // Estados para la reserva
  const [boletoSeleccionado, setBoletoSeleccionado] = useState<number | null>(null);
  const [email, setEmail] = useState('');
  const [voucherUrl, setVoucherUrl] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);
  const [errorBoletos, setErrorBoletos] = useState('');

  useEffect(() => {
    if (!id) return;

    // 1. Cargar datos base de la rifa
    const fetchRifa = async () => {
      const docRef = doc(db, 'rifas', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setRifa({ id: docSnap.id, ...docSnap.data() });
      }
    };
    fetchRifa();

    // 2. Escuchar subcolección de boletos en tiempo real (HU-9)
    const boletosRef = collection(db, 'rifas', id, 'boletos');
    const unsubscribe = onSnapshot(
      boletosRef,
      (snapshot) => {
        const boletosData: Record<string, Boleto> = {};
        snapshot.forEach(doc => {
          boletosData[doc.id] = doc.data() as Boleto;
        });
        setBoletosReservados(boletosData);
        setErrorBoletos('');
      },
      (err) => {
        console.error('Error al cargar los boletos: ', err);
        setErrorBoletos('No pudimos verificar la disponibilidad de los boletos. Recarga la página antes de reservar.');
      }
    );

    return () => unsubscribe();
  }, [id]);

  const handleSeleccionarBoleto = (numeroBoleto: number) => {
    const estadoActual = boletosReservados[numeroBoleto.toString()]?.estado;
    if (estadoActual === 'pendiente' || estadoActual === 'comprado') return;

    setBoletoSeleccionado(numeroBoleto);
    setMensaje('');
  };

  const handleReservar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !boletoSeleccionado) return;

    const numeroBoleto = boletoSeleccionado;

    try {
      const boletoRef = doc(db, 'rifas', id, 'boletos', numeroBoleto.toString());
      await runTransaction(db, async (transaction) => {
        const boletoSnap = await transaction.get(boletoRef);
        if (boletoSnap.exists()) {
          throw new Error('BOLETO_OCUPADO');
        }
        transaction.set(boletoRef, {
          estado: 'pendiente',
          compradorEmail: email,
          voucherUrl: voucherUrl,
          fechaReserva: new Date().toISOString()
        });
      });

      setEsError(false);
      setMensaje('¡Boleto reservado con éxito! El administrador validará tu comprobante.');
      setBoletoSeleccionado(null);
      setEmail('');
      setVoucherUrl('');
    } catch (error) {
      console.error("Error al reservar: ", error);
      setEsError(true);
      if (error instanceof Error && error.message === 'BOLETO_OCUPADO') {
        setMensaje(`El boleto #${numeroBoleto} acaba de ser reservado por otra persona. Por favor elige otro.`);
        setBoletoSeleccionado(null);
      } else {
        setMensaje('Hubo un error al procesar la reserva.');
      }
    }
  };

  if (!rifa) return <div className="detail-container">Cargando detalles...</div>;

  const totalBoletos = Array.from({ length: rifa.cantidadBoletos }, (_, i) => i + 1);

  return (
    <div className="detail-container">
      <header className="detail-header">
        <h1>{rifa.titulo}</h1>
        <p>Selecciona un boleto disponible para participar.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
          <span style={{ color: '#10b981' }}>🟩 Disponible</span>
          <span style={{ color: '#f59e0b' }}>🟧 En Validación</span>
          <span style={{ color: '#ef4444' }}>🟥 Comprado</span>
        </div>
      </header>

      {errorBoletos && (
        <div className="alerta-boletos" role="alert">{errorBoletos}</div>
      )}

      {/* Matriz de Boletos */}
      <div className="tickets-grid">
        {totalBoletos.map(numero => {
          const boletoDB = boletosReservados[numero.toString()];
          const estado = boletoDB ? boletoDB.estado : 'disponible';

          return (
            <button
              key={numero}
              className={`ticket-btn ticket-${estado}`}
              onClick={() => handleSeleccionarBoleto(numero)}
              disabled={estado !== 'disponible'}
              title={estado !== 'disponible' ? `Boleto ${estado}` : 'Clic para seleccionar'}
            >
              {numero}
            </button>
          );
        })}
      </div>

      {/* Panel de Carga de Comprobante*/}
      {boletoSeleccionado && (
        <div className="reservation-panel">
          <h3>Completar Reserva - Boleto <span className="selected-ticket-badge">#{boletoSeleccionado}</span></h3>
          <form className="auth-form" onSubmit={handleReservar}>
            <div className="input-group">
              <label>Correo Electrónico de Contacto</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" />
            </div>
            <div className="input-group">
              <label>URL del Comprobante de Transferencia (Voucher)</label>
              <input type="url" required value={voucherUrl} onChange={(e) => setVoucherUrl(e.target.value)} placeholder="https://ejemplo.com/voucher.png" />
            </div>
            <button type="submit" className="auth-button">Confirmar Reserva y Subir Voucher</button>
            <button type="button" onClick={() => setBoletoSeleccionado(null)} className="auth-button" style={{ background: '#6b7280', marginTop: '0.5rem' }}>Cancelar Selección</button>
          </form>
        </div>
      )}

      {mensaje && (
        <div
          className={esError ? 'mensaje-error' : 'mensaje-exito'}
          role={esError ? 'alert' : 'status'}
        >
          {mensaje}
        </div>
      )}
    </div>
  );
};
