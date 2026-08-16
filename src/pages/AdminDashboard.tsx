import React, { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
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
  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) navigate('/login');
    });

    // Cargar rifas en tiempo real
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
                <div>
                  <span style={{ color: 'green', fontWeight: 'bold' }}>{rifa.estado.toUpperCase()}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
};
