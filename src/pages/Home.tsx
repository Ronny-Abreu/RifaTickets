import React, { useState, useEffect } from 'react';
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
}

export const Home: React.FC = () => {
  const [rifas, setRifas] = useState<RifaPublica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'rifas'),
      where('estado', '==', 'activa')
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

  if (loading) {
    return <div className="public-container"><p>Cargando rifas disponibles...</p></div>;
  }

  if (error) {
    return <div className="public-container"><p>{error}</p></div>;
  }

  return (
    <div className="public-container">
      <header className="public-header">
        <h1>🎟️ RifaTickets</h1>
        <p>Participa en las mejores rifas y gana premios increíbles</p>
      </header>

      <div className="rifas-grid">
        {rifas.length === 0 ? (
          <p>No hay rifas activas en este momento. Vuelve pronto.</p>
        ) : (
          rifas.map(rifa => (
            <article key={rifa.id} className="rifa-card">
              <img src={rifa.imagenUrl} alt={rifa.titulo} className="rifa-img" />
              <div className="rifa-info">
                <h3>{rifa.titulo}</h3>
                <div className="rifa-stats">
                  <span>🎯 {rifa.cantidadBoletos} Boletos</span>
                  <span>⏳ Cierra: {rifa.fechaFin}</span>
                </div>
                <Link to={`/rifa/${rifa.id}`} className="btn-participar">
                  Ver Boletos y Participar
                </Link>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
