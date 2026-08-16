import React, { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';
import '../styles/Auth.css';

interface Rifa {
  id: string;
  titulo: string;
  cantidadBoletos: number;
  imagenUrl: string;
  fechaFin: string;
  estado: string;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [titulo, setTitulo] = useState('');
  const [cantidadBoletos, setCantidadBoletos] = useState<number>(100);
  const [imagenUrl, setImagenUrl] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  // Gestión de reservas (HU-12 / HU-13)
  const [reservas, setReservas] = useState<any[]>([]);
  const [rifaSeleccionada, setRifaSeleccionada] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) navigate('/login');
    });

    const q = query(collection(db, 'rifas'), orderBy('fechaCreacion', 'desc'));
    const unsubscribeDb = onSnapshot(q, (snapshot) => {
      const rifasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Rifa[];
      setRifas(rifasData);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDb();
    };
  }, [navigate]);

  useEffect(() => {
    if (!rifaSeleccionada) {
      setReservas([]);
      return;
    }

    const reservasRef = collection(db, 'rifas', rifaSeleccionada, 'boletos');
    const unsubscribe = onSnapshot(reservasRef, (snapshot) => {
      const reservasData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((boleto: any) => boleto.estado === 'pendiente');
      setReservas(reservasData);
    });

    return () => unsubscribe();
  }, [rifaSeleccionada]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const handleCrearRifa = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'rifas'), {
        titulo,
        cantidadBoletos,
        imagenUrl,
        fechaFin,
        estado: 'activa',
        fechaCreacion: new Date().toISOString()
      });
      setTitulo('');
      setImagenUrl('');
    } catch (error) {
      console.error("Error al crear la rifa: ", error);
      alert("Hubo un error al crear la rifa");
    }
  };

  const verReservas = (rifaId: string) => {
    setRifaSeleccionada(rifaId);
  };

  const aprobarVoucher = async (numeroBoleto: string) => {
    if (!rifaSeleccionada) return;
    try {
      const boletoRef = doc(db, 'rifas', rifaSeleccionada, 'boletos', numeroBoleto);
      await updateDoc(boletoRef, { estado: 'comprado' });
      alert(`Boleto #${numeroBoleto} aprobado exitosamente.`);
    } catch (error) {
      console.error("Error al aprobar:", error);
    }
  };

  const rechazarVoucher = async (numeroBoleto: string) => {
    if (!rifaSeleccionada) return;
    try {
      const boletoRef = doc(db, 'rifas', rifaSeleccionada, 'boletos', numeroBoleto);
      await deleteDoc(boletoRef);
      alert(`Reserva del boleto #${numeroBoleto} rechazada. Boleto liberado.`);
    } catch (error) {
      console.error("Error al rechazar:", error);
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h2>Panel de Administración - RifaTickets</h2>
        <button onClick={handleLogout} className="logout-btn">Cerrar Sesión</button>
      </header>

      <div className="dashboard-content">
        {/* Formulario de Creación */}
        <section className="form-card">
          <h3>Crear Nueva Rifa</h3>
          <form className="rifa-form" onSubmit={handleCrearRifa}>
            <div className="input-group">
              <label>Título de la Rifa</label>
              <input type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Gran Rifa de Laptop" />
            </div>
            <div className="input-group">
              <label>Cantidad de Boletos</label>
              <input type="number" required min="10" value={cantidadBoletos} onChange={(e) => setCantidadBoletos(Number(e.target.value))} />
            </div>
            <div className="input-group">
              <label>URL de Imagen representativa</label>
              <input type="url" required value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} placeholder="https://ejemplo.com/foto.jpg" />
            </div>
            <div className="input-group">
              <label>Fecha Límite</label>
              <input type="date" required value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
            <button type="submit" className="auth-button">Publicar Rifa</button>
          </form>
        </section>

        {/* Lista de Rifas Activas */}
        <section className="list-card">
          <h3>Mis Rifas Activas</h3>
          {rifas.length === 0 ? (
            <p>No has creado ninguna rifa todavía.</p>
          ) : (
            rifas.map(rifa => (
              <div key={rifa.id} className="rifa-item">
                <div>
                  <h4>{rifa.titulo}</h4>
                  <p>Boletos: {rifa.cantidadBoletos} | Finaliza: {rifa.fechaFin}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ color: 'green', fontWeight: 'bold' }}>{rifa.estado.toUpperCase()}</span>
                  <button onClick={() => verReservas(rifa.id)} className="auth-button" style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                    Gestionar Reservas
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Panel de Validación de Vouchers */}
        {rifaSeleccionada && (
          <section className="form-card" style={{ gridColumn: '1 / -1', marginTop: '2rem' }}>
            <h3>Reservas Pendientes de Validación</h3>
            {reservas.length === 0 ? (
              <p>No hay reservas pendientes para esta rifa.</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {reservas.map(reserva => (
                  <div key={reserva.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', border: '1px solid #f59e0b', borderRadius: '8px', background: '#fffbeb' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#b45309' }}>Boleto #{reserva.id}</h4>
                      <p style={{ margin: 0 }}><strong>Email:</strong> {reserva.compradorEmail}</p>
                      <a href={reserva.voucherUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: '0.9rem' }}>Ver Comprobante Subido</a>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button onClick={() => aprobarVoucher(reserva.id)} style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Aprobar</button>
                      <button onClick={() => rechazarVoucher(reserva.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Rechazar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
