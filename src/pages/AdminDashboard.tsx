import React, { useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { BANCOS_DISPONIBLES } from '../constants/bancos';
import '../styles/Dashboard.css';
import '../styles/Auth.css';

interface Rifa {
  id: string;
  titulo: string;
  cantidadBoletos: number;
  imagenUrl: string;
  fechaFin: string;
  estado: string;
  precioBoleto?: number;
  ganadorEmail?: string;
  ganadorBoleto?: string;
  cuentasBancarias?: CuentaBancaria[];
}

export interface CuentaBancaria {
  bancoId: string;
  cuenta: string;
}

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [rifas, setRifas] = useState<Rifa[]>([]);
  const [titulo, setTitulo] = useState('');
  const [cantidadBoletos, setCantidadBoletos] = useState<number>(100);
  const [precioBoleto, setPrecioBoleto] = useState<number>(100);
  const [imagenFile, setImagenFile] = useState<File | null>(null);
  const [fechaFin, setFechaFin] = useState('');
  const [creando, setCreando] = useState(false);

  // Gestión de reservas
  const [reservas, setReservas] = useState<any[]>([]);
  const [boletosComprados, setBoletosComprados] = useState<any[]>([]);
  const [rifaSeleccionada, setRifaSeleccionada] = useState<string | null>(null);

  // Edición de rifa
  const [editandoRifa, setEditandoRifa] = useState<Rifa | null>(null);
  const [editTitulo, setEditTitulo] = useState('');
  const [editCantidadBoletos, setEditCantidadBoletos] = useState<number>(100);
  const [editPrecioBoleto, setEditPrecioBoleto] = useState<number>(100);
  const [editFechaFin, setEditFechaFin] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [editImagenFile, setEditImagenFile] = useState<File | null>(null);
  const [editCuentas, setEditCuentas] = useState<CuentaBancaria[]>([]);
  const [guardando, setGuardando] = useState(false);

  // Ruleta
  const [isSpinning, setIsSpinning] = useState(false);
  const [ganadorSeleccionado, setGanadorSeleccionado] = useState<any>(null);

  // Cuentas Bancarias (Paso 2 de creación)
  const [creacionPaso, setCreacionPaso] = useState<1 | 2>(1);
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [nuevoBancoId, setNuevoBancoId] = useState('');
  const [nuevaCuentaNum, setNuevaCuentaNum] = useState('');

  // Edición temporal de bancos
  const [editNuevoBancoId, setEditNuevoBancoId] = useState('');
  const [editNuevaCuentaNum, setEditNuevaCuentaNum] = useState('');

  const rifaActiva = rifas.find(r => r.id === rifaSeleccionada);

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
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pendientes = allData.filter((boleto: any) => boleto.estado === 'pendiente');
      const comprados = allData.filter((boleto: any) => boleto.estado === 'comprado');
      setReservas(pendientes);
      setBoletosComprados(comprados);
    });

    return () => unsubscribe();
  }, [rifaSeleccionada]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const subirImagenCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'RifaTickets voucher');

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'powgv8eg'}/image/upload`;

    const response = await Promise.race([
      fetch(cloudinaryUrl, { method: 'POST', body: formData }),
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: la subida tardó más de 20 segundos')), 20000)
      ),
    ]);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudinary respondió ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return data.secure_url;
  };

  const handleContinuarPaso2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imagenFile) {
      alert('Selecciona una imagen para la rifa.');
      return;
    }
    setCreacionPaso(2);
  };

  const agregarCuentaAlCrear = () => {
    if (!nuevoBancoId || !nuevaCuentaNum) {
      alert("Selecciona el banco e ingresa el número de cuenta.");
      return;
    }
    setCuentasBancarias([...cuentasBancarias, { bancoId: nuevoBancoId, cuenta: nuevaCuentaNum }]);
    setNuevoBancoId('');
    setNuevaCuentaNum('');
  };

  const eliminarCuentaCrear = (index: number) => {
    const nuevas = [...cuentasBancarias];
    nuevas.splice(index, 1);
    setCuentasBancarias(nuevas);
  };

  const publicarRifa = async () => {
    if (cuentasBancarias.length === 0) {
      if (!confirm('No has agregado ninguna cuenta bancaria. ¿Deseas publicar la rifa sin cuentas bancarias?')) return;
    }
    setCreando(true);
    try {
      const imagenUrl = await subirImagenCloudinary(imagenFile!);

      await addDoc(collection(db, 'rifas'), {
        titulo,
        cantidadBoletos,
        precioBoleto,
        imagenUrl,
        fechaFin,
        estado: 'activa',
        cuentasBancarias,
        fechaCreacion: new Date().toISOString()
      });

      setTitulo('');
      setImagenFile(null);
      setCantidadBoletos(100);
      setPrecioBoleto(100);
      setFechaFin('');
      setCuentasBancarias([]);
      setCreacionPaso(1);

      const fileInput = document.getElementById('imagen-rifa') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error("Error al crear la rifa: ", error);
      alert("Hubo un error al crear la rifa");
    } finally {
      setCreando(false);
    }
  };

  const verReservas = (rifaId: string) => {
    setRifaSeleccionada(rifaId);
    setTimeout(() => {
      document.getElementById('reservas-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

  // Eliminar rifa
  const handleEliminarRifa = async (rifaId: string, tituloRifa: string) => {
    if (!confirm(`¿Eliminar la rifa "${tituloRifa}"? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, 'rifas', rifaId));
      if (rifaSeleccionada === rifaId) setRifaSeleccionada(null);
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error al eliminar la rifa.");
    }
  };

  const jugarRuleta = async () => {
    if (boletosComprados.length === 0) {
      alert("No hay boletos validados para realizar el sorteo.");
      return;
    }
    
    setIsSpinning(true);
    setGanadorSeleccionado(null);
    
    // Simular el giro por 15 segundos
    setTimeout(async () => {
      // Elegir ganador al azar
      const randomIndex = Math.floor(Math.random() * boletosComprados.length);
      const ganador = boletosComprados[randomIndex];
      setGanadorSeleccionado(ganador);
      setIsSpinning(false);
      
      // Actualizar Firestore
      if (rifaSeleccionada) {
        try {
          await updateDoc(doc(db, 'rifas', rifaSeleccionada), {
            estado: 'finalizada',
            ganadorEmail: ganador.compradorEmail,
            ganadorBoleto: ganador.id
          });
          alert(`¡El ganador es el boleto #${ganador.id}!`);
        } catch (error) {
          console.error("Error al guardar ganador:", error);
          alert("Error al guardar el ganador en la base de datos.");
        }
      }
    }, 15000);
  };

  // Abrir modal de edición
  const abrirEdicion = (rifa: Rifa) => {
    setEditandoRifa(rifa);
    setEditTitulo(rifa.titulo);
    setEditCantidadBoletos(rifa.cantidadBoletos);
    setEditPrecioBoleto(rifa.precioBoleto || 100);
    setEditFechaFin(rifa.fechaFin);
    setEditEstado(rifa.estado);
    setEditImagenFile(null);
    setEditCuentas(rifa.cuentasBancarias || []);
    setEditNuevoBancoId('');
    setEditNuevaCuentaNum('');
  };

  const agregarCuentaEdit = () => {
    if (!editNuevoBancoId || !editNuevaCuentaNum) {
      alert("Selecciona el banco e ingresa el número de cuenta.");
      return;
    }
    setEditCuentas([...editCuentas, { bancoId: editNuevoBancoId, cuenta: editNuevaCuentaNum }]);
    setEditNuevoBancoId('');
    setEditNuevaCuentaNum('');
  };

  const eliminarCuentaEdit = (index: number) => {
    const nuevas = [...editCuentas];
    nuevas.splice(index, 1);
    setEditCuentas(nuevas);
  };

  // Guardar edición
  const handleGuardarEdicion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editandoRifa) return;

    // Verificar si hay cambios antes de guardar
    const hayCambios = 
      editTitulo !== editandoRifa.titulo ||
      editCantidadBoletos !== editandoRifa.cantidadBoletos ||
      editPrecioBoleto !== (editandoRifa.precioBoleto || 100) ||
      editFechaFin !== editandoRifa.fechaFin ||
      editEstado !== editandoRifa.estado ||
      editImagenFile !== null ||
      JSON.stringify(editCuentas) !== JSON.stringify(editandoRifa.cuentasBancarias || []);

    if (!hayCambios) {
      setEditandoRifa(null);
      return;
    }

    setGuardando(true);
    try {
      const updates: Record<string, any> = {
        titulo: editTitulo,
        cantidadBoletos: editCantidadBoletos,
        precioBoleto: editPrecioBoleto,
        fechaFin: editFechaFin,
        estado: editEstado,
        cuentasBancarias: editCuentas,
      };

      if (editImagenFile) {
        console.log('[Editar] Subiendo imagen a Cloudinary...');
        updates.imagenUrl = await subirImagenCloudinary(editImagenFile);
        console.log('[Editar] Imagen subida:', updates.imagenUrl);
      }

      console.log('[Editar] Actualizando documento:', editandoRifa.id, updates);

      // Timeout de seguridad para evitar hang indefinido
      await Promise.race([
        updateDoc(doc(db, 'rifas', editandoRifa.id), updates),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout: updateDoc tardó más de 15 segundos')), 15000)
        ),
      ]);

      console.log('[Editar] Documento actualizado correctamente');
      setEditandoRifa(null);
    } catch (error: any) {
      console.error('[Editar] Error:', error);
      alert('Error al guardar: ' + (error.message || error));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="dashboard-container">
        <header className="dashboard-header">
        <h2>Panel de Administración - RifaTickets</h2>
        <button onClick={handleLogout} className="logout-btn">Cerrar Sesión</button>
      </header>

      <div className="dashboard-content">
        {/* Formulario de Creación */}
        <section className="form-card">
          <h3>Crear Nueva Rifa {creacionPaso === 2 && "- Bancos (Paso 2)"}</h3>
          
          {creacionPaso === 1 ? (
            <form className="rifa-form" onSubmit={handleContinuarPaso2}>
              <div className="input-group">
                <label>Título de la Rifa</label>
                <input type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Gran Rifa de Laptop" />
              </div>
              <div className="input-group">
                <label>Cantidad de Boletos</label>
                <input type="number" required min="10" value={cantidadBoletos} onChange={(e) => setCantidadBoletos(Number(e.target.value))} />
              </div>
              <div className="input-group">
                <label>Precio por Boleto (DOP)</label>
                <input type="number" required min="1" value={precioBoleto} onChange={(e) => setPrecioBoleto(Number(e.target.value))} />
              </div>
              <div className="input-group">
                <label>Imagen de la Rifa</label>
                <input
                  id="imagen-rifa"
                  type="file"
                  required
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setImagenFile(e.target.files?.[0] || null)}
                />
              </div>
              <div className="input-group">
                <label>Fecha Límite</label>
                <input type="date" required value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
              </div>
              <button type="submit" className="auth-button">
                Continuar
              </button>
            </form>
          ) : (
            <div className="rifa-form">
              <div className="input-group">
                <label>Seleccionar Banco</label>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {BANCOS_DISPONIBLES.map(b => (
                    <div 
                      key={b.id} 
                      className={`bank-selector ${nuevoBancoId === b.id ? 'selected' : ''}`}
                      onClick={() => setNuevoBancoId(b.id)}
                    >
                      <img src={b.img} alt={b.nombre} style={{ width: '80px', height: 'auto', objectFit: 'contain' }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="input-group">
                <label>Número de Cuenta</label>
                <input type="text" value={nuevaCuentaNum} onChange={e => setNuevaCuentaNum(e.target.value)} placeholder="Ej. 123456789" />
              </div>
              <button type="button" className="auth-button" style={{ background: '#10b981' }} onClick={agregarCuentaAlCrear}>
                Agregar Cuenta
              </button>

              {cuentasBancarias.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4>Cuentas Agregadas:</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {cuentasBancarias.map((cta, idx) => {
                      const bInfo = BANCOS_DISPONIBLES.find(b => b.id === cta.bancoId);
                      return (
                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '4px', marginBottom: '0.5rem', alignItems: 'center' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {bInfo && <img src={bInfo.img} alt={bInfo.nombre} style={{ height: '24px' }} />}
                            {bInfo?.nombre} - {cta.cuenta}
                          </span>
                          <button onClick={() => eliminarCuentaCrear(idx)} style={{ color: 'red', border: 'none', background: 'transparent', cursor: 'pointer' }}><i className="fa-solid fa-trash"></i></button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="auth-button btn-red" style={{ flex: 1 }} onClick={() => setCreacionPaso(1)}>Volver</button>
                <button type="button" className="auth-button" style={{ flex: 1 }} disabled={creando} onClick={publicarRifa}>
                  {creando ? 'Publicando...' : 'Publicar Rifa'}
                </button>
              </div>
            </div>
          )}
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
                <div className="rifa-actions">
                  <span className="rifa-estado">{rifa.estado.toUpperCase()}</span>
                  <button onClick={() => verReservas(rifa.id)} className="btn-action btn-reservas">
                    Reservas
                  </button>
                  <button onClick={() => abrirEdicion(rifa)} className="btn-action btn-editar">
                    Editar
                  </button>
                  <button onClick={() => handleEliminarRifa(rifa.id, rifa.titulo)} className="btn-action btn-eliminar">
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* Modal de Edición */}
        {editandoRifa && (
          <div className="modal-overlay" onClick={() => setEditandoRifa(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Editar Rifa</h3>
              <form className="rifa-form" onSubmit={handleGuardarEdicion}>
                <div className="input-group">
                  <label>Título</label>
                  <input type="text" required value={editTitulo} onChange={(e) => setEditTitulo(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Cantidad de Boletos</label>
                  <input type="number" required min="10" value={editCantidadBoletos} onChange={(e) => setEditCantidadBoletos(Number(e.target.value))} />
                </div>
                <div className="input-group">
                  <label>Precio por Boleto (DOP)</label>
                  <input type="number" required min="1" value={editPrecioBoleto} onChange={(e) => setEditPrecioBoleto(Number(e.target.value))} />
                </div>
                <div className="input-group">
                  <label>Nueva Imagen (opcional)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setEditImagenFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="input-group">
                  <label>Fecha Límite</label>
                  <input type="date" required value={editFechaFin} onChange={(e) => setEditFechaFin(e.target.value)} />
                </div>
                
                {/* Edición de Bancos */}
                <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '1rem', paddingTop: '1rem' }}>
                  <h4>Cuentas Bancarias</h4>
                  <div className="input-group" style={{ marginTop: '0.5rem' }}>
                    <label>Seleccionar Banco</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {BANCOS_DISPONIBLES.map(b => (
                        <div 
                          key={b.id} 
                          className={`bank-selector ${editNuevoBancoId === b.id ? 'selected' : ''}`}
                          onClick={() => setEditNuevoBancoId(b.id)}
                        >
                          <img src={b.img} alt={b.nombre} style={{ width: '60px', height: 'auto', objectFit: 'contain' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="input-group">
                    <label>Número de Cuenta</label>
                    <input type="text" value={editNuevaCuentaNum} onChange={e => setEditNuevaCuentaNum(e.target.value)} placeholder="Ej. 123456789" />
                  </div>
                  <button type="button" className="auth-button" style={{ background: '#10b981', padding: '0.5rem 1rem', marginTop: '0.5rem' }} onClick={agregarCuentaEdit}>
                    Agregar Cuenta
                  </button>

                  {editCuentas.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem' }}>
                      {editCuentas.map((cta, idx) => {
                        const bInfo = BANCOS_DISPONIBLES.find(b => b.id === cta.bancoId);
                        return (
                          <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', background: '#f3f4f6', padding: '0.5rem 1rem', borderRadius: '4px', marginBottom: '0.5rem', alignItems: 'center' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {bInfo && <img src={bInfo.img} alt={bInfo.nombre} style={{ height: '20px' }} />}
                              {bInfo?.nombre} - {cta.cuenta}
                            </span>
                            <button type="button" onClick={() => eliminarCuentaEdit(idx)} style={{ color: 'red', border: 'none', background: 'transparent', cursor: 'pointer' }}><i className="fa-solid fa-trash"></i></button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="input-group" style={{ borderTop: '1px solid #e5e7eb', marginTop: '1rem', paddingTop: '1rem' }}>
                  <label>Estado</label>
                  <select value={editEstado} onChange={(e) => setEditEstado(e.target.value)}>
                    <option value="activa">Activa</option>
                    <option value="finalizada">Finalizada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>
                
                {(() => {
                  const hayCambios = 
                    editTitulo !== editandoRifa?.titulo ||
                    editCantidadBoletos !== editandoRifa?.cantidadBoletos ||
                    editPrecioBoleto !== (editandoRifa?.precioBoleto || 100) ||
                    editFechaFin !== editandoRifa?.fechaFin ||
                    editEstado !== editandoRifa?.estado ||
                    editImagenFile !== null;

                  return (
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button type="submit" className="auth-button" disabled={guardando || !hayCambios} style={{ flex: 1 }}>
                        {guardando ? 'Guardando...' : 'Guardar Cambios'}
                      </button>
                      <button type="button" className="auth-button btn-red" onClick={() => setEditandoRifa(null)} style={{ flex: 1 }}>
                        Cancelar
                      </button>
                    </div>
                  );
                })()}
              </form>
            </div>
          </div>
        )}

        {/* Panel de Validación de Vouchers */}
        {rifaSeleccionada && (
          <section id="reservas-section" className="form-card" style={{ gridColumn: '1 / -1', marginTop: '2rem' }}>
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

        {/* Panel de Boletos Validados */}
        {rifaSeleccionada && (
          <section className="form-card" style={{ gridColumn: '1 / -1', marginTop: '2rem' }}>
            <h3>Boletos Validados (Comprados)</h3>
            {boletosComprados.length === 0 ? (
              <p>No hay boletos validados para esta rifa todavía.</p>
            ) : (
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                {boletosComprados.map(boleto => (
                  <div key={boleto.id} style={{ padding: '1rem', border: '1px solid #10b981', borderRadius: '8px', background: '#ecfdf5', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, color: '#047857' }}>Boleto #{boleto.id}</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', wordBreak: 'break-all' }}><strong>Email:</strong> {boleto.compradorEmail}</p>
                    <span style={{ fontSize: '0.8rem', background: '#10b981', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', alignSelf: 'flex-start' }}>VALIDADO</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Panel de Ruleta (Elegir Ganador) */}
        {rifaSeleccionada && rifaActiva && (
          <section className="form-card" style={{ gridColumn: '1 / -1', marginTop: '2rem', textAlign: 'center' }}>
            <h3>Ruleta de Ganador</h3>
            
            {rifaActiva.estado === 'finalizada' ? (
              <div style={{ background: '#ecfdf5', border: '2px solid #10b981', padding: '2rem', borderRadius: '12px' }}>
                <h2 style={{ color: '#047857', margin: '0 0 1rem 0' }}>¡Esta dinámica ya ha finalizado!</h2>
                <p style={{ fontSize: '1.2rem', margin: 0 }}>Ganador: <strong>{rifaActiva.ganadorEmail}</strong> (Boleto #{rifaActiva.ganadorBoleto})</p>
              </div>
            ) : (
              <div style={{ position: 'relative', width: '300px', height: '300px', margin: '0 auto' }}>
                <div className={`roulette-wheel ${isSpinning ? 'spinning' : ''}`} onClick={!isSpinning ? jugarRuleta : undefined}>
                  <div className="roulette-center">
                    {isSpinning ? "Girando" : "JUGAR"}
                  </div>
                  {/* Puntos de la ruleta */}
                  {boletosComprados.map((boleto, index) => {
                    const rotation = (360 / boletosComprados.length) * index;
                    return (
                      <div key={boleto.id} className="roulette-segment" style={{ transform: `rotate(${rotation}deg) skewY(${90 - (360 / boletosComprados.length)}deg)` }}>
                        <span className="roulette-text" style={{ transform: `skewY(-${90 - (360 / boletosComprados.length)}deg) rotate(${360 / boletosComprados.length / 2}deg)` }}>
                          #{boleto.id}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="roulette-pointer"></div>
              </div>
            )}
            
            {ganadorSeleccionado && (
              <div style={{ marginTop: '2rem', padding: '1rem', background: '#fef3c7', borderRadius: '8px', border: '2px solid #f59e0b' }}>
                <h3 style={{ margin: 0, color: '#b45309', marginBottom: '0.5rem' }}>¡Ganador Seleccionado!</h3>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: 0 }}>Boleto #{ganadorSeleccionado.id} - {ganadorSeleccionado.compradorEmail}</p>
              </div>
            )}
          </section>
        )}
      </div>
      </div>
    </div>
  );
};
