import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, onSnapshot, runTransaction } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { BANCOS_DISPONIBLES } from '../constants/bancos';
import '../styles/RifaDetail.css';

interface CuentaBancaria {
  bancoId: string;
  cuenta: string;
}

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
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [bancoSeleccionado, setBancoSeleccionado] = useState<string | null>(null);
  const [voucherUrl, setVoucherUrl] = useState('');
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [errorVoucher, setErrorVoucher] = useState('');
  const [subiendoVoucher, setSubiendoVoucher] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [esError, setEsError] = useState(false);
  const [errorBoletos, setErrorBoletos] = useState('');

  const TIPOS_IMAGEN_PERMITIDOS = ['image/jpeg', 'image/png'];
  const TAMANO_MAXIMO_BYTES = 5 * 1024 * 1024;

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0] ?? null;
    setErrorVoucher('');

    if (!archivo) {
      setVoucherFile(null);
      return;
    }
    if (!TIPOS_IMAGEN_PERMITIDOS.includes(archivo.type)) {
      setErrorVoucher('Solo se aceptan imágenes en formato JPEG o PNG.');
      e.target.value = '';
      setVoucherFile(null);
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_BYTES) {
      setErrorVoucher('La imagen no puede superar los 5 MB.');
      e.target.value = '';
      setVoucherFile(null);
      return;
    }
    setVoucherUrl('');
    setVoucherFile(archivo);
  };

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

    // 2. Escuchar subcolección de boletos en tiempo real
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
    const numeroBoleto = boletoSeleccionado;
    if (!numeroBoleto || !id) return;

    if (rifa.cuentasBancarias && rifa.cuentasBancarias.length > 0 && !bancoSeleccionado) {
      setErrorVoucher('Por favor selecciona un banco para realizar el pago.');
      return;
    }

    if (!voucherUrl && !voucherFile) {
      setErrorVoucher('Por favor, ingresa la URL o sube una imagen de tu comprobante de pago.');
      return;
    }

    try {
      let urlFinalVoucher = voucherUrl;
      if (voucherFile) {
        setSubiendoVoucher(true);
        const formData = new FormData();
        formData.append('file', voucherFile);
        formData.append('upload_preset', import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'RifaTickets voucher');

        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'powgv8eg'}/image/upload`;

        const conLimiteDeTiempo = <T,>(promesa: Promise<T>): Promise<T> =>
          Promise.race([
            promesa,
            new Promise<T>((_, reject) =>
              setTimeout(() => reject(new Error('SUBIDA_TIMEOUT')), 20000)
            )
          ]);

        const response = await conLimiteDeTiempo(fetch(cloudinaryUrl, {
          method: 'POST',
          body: formData
        }));

        if (!response.ok) {
          throw new Error('Error al subir imagen a Cloudinary');
        }

        const data = await response.json();
        urlFinalVoucher = data.secure_url;
      }

      const boletoRef = doc(db, 'rifas', id, 'boletos', numeroBoleto.toString());
      await runTransaction(db, async (transaction) => {
        const boletoSnap = await transaction.get(boletoRef);
        if (boletoSnap.exists()) {
          throw new Error('BOLETO_OCUPADO');
        }
        transaction.set(boletoRef, {
          estado: 'pendiente',
          compradorNombre: nombre,
          compradorEmail: email,
          voucherUrl: urlFinalVoucher,
          fechaReserva: new Date().toISOString()
        });
      });

      setEsError(false);
      setMensaje('¡Boleto reservado con éxito! El administrador validará tu comprobante.');
      setBoletoSeleccionado(null);
      setNombre('');
      setEmail('');
      setVoucherUrl('');
      setVoucherFile(null);
      setErrorVoucher('');
    } catch (error) {
      console.error("Error al reservar: ", error);
      setEsError(true);
      if (error instanceof Error && error.message === 'BOLETO_OCUPADO') {
        setMensaje(`El boleto #${numeroBoleto} acaba de ser reservado por otra persona. Por favor elige otro.`);
        setBoletoSeleccionado(null);
      } else {
        setMensaje('Hubo un error al procesar la reserva.');
      }
    } finally {
      setSubiendoVoucher(false);
    }
  };

  if (!rifa) return <div className="detail-wrapper"><div className="detail-container">Cargando detalles...</div></div>;

  const totalBoletos = Array.from({ length: rifa.cantidadBoletos }, (_, i) => i + 1);

  const boletosComprados = Object.values(boletosReservados).filter(b => b.estado === 'comprado').length;
  const boletosPendientes = Object.values(boletosReservados).filter(b => b.estado === 'pendiente').length;
  const boletosDisponibles = rifa.cantidadBoletos - boletosComprados - boletosPendientes;

  return (
    <div className="detail-wrapper">
      <div className="detail-container">
        <header className="detail-header">
          <h1>{rifa.titulo}</h1>
          <p>Selecciona un boleto disponible para participar.</p>

          <div className="legend-container">
            <div className="legend-item">
              <span className="legend-color disponible"></span> Disponible
            </div>
            <div className="legend-item">
              <span className="legend-color validacion"></span> En Validación
            </div>
            <div className="legend-item">
              <span className="legend-color comprado"></span> Comprado
            </div>
          </div>

          <div className="tickets-stats">
            <div className="stat-item">
              <span className="stat-label">Disponibles</span>
              <span className="stat-value">{boletosDisponibles}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">En validación</span>
              <span className="stat-value">{boletosPendientes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Comprados</span>
              <span className="stat-value">{boletosComprados}</span>
            </div>
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

        {/* Panel de Carga de Comprobante Modal */}
        {boletoSeleccionado && (
          <div className="modal-overlay" onClick={() => !subiendoVoucher && setBoletoSeleccionado(null)}>
            <div className="reservation-panel modal-content" onClick={(e) => e.stopPropagation()}>
              <h3>Completar Reserva - Boleto <span className="">#{boletoSeleccionado}</span></h3>
              <form className="auth-form" onSubmit={handleReservar}>
                <div className="input-group">
                  <label>Nombre Completo</label>
                  <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" disabled={subiendoVoucher} />
                </div>
                <div className="input-group">
                  <label>Correo Electrónico de Contacto</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" disabled={subiendoVoucher} />
                </div>

                {/* Seleccion de Banco */}
                {rifa.cuentasBancarias && rifa.cuentasBancarias.length > 0 && (
                  <div className="input-group" style={{ marginTop: '0.5rem' }}>
                    <label>Selecciona un Banco para Transferir</label>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {rifa.cuentasBancarias.map((cta: CuentaBancaria) => {
                        const bInfo = BANCOS_DISPONIBLES.find(b => b.id === cta.bancoId);
                        if (!bInfo) return null;
                        const isSelected = bancoSeleccionado === cta.bancoId;
                        return (
                          <div
                            key={cta.bancoId}
                            style={{
                              border: isSelected ? '2px solid #2563eb' : '2px solid #e5e7eb',
                              borderRadius: '8px', padding: '0.5rem', cursor: 'pointer',
                              backgroundColor: isSelected ? '#eff6ff' : 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                            onClick={() => setBancoSeleccionado(cta.bancoId)}
                          >
                            <img src={bInfo.img} alt={bInfo.nombre} style={{ width: '60px', height: 'auto', objectFit: 'contain' }} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {bancoSeleccionado && rifa.cuentasBancarias && (
                  <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #10b981', marginTop: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#4b5563' }}>Realiza la transferencia a la siguiente cuenta:</p>
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.2rem', fontWeight: 'bold', color: '#111827' }}>
                      {BANCOS_DISPONIBLES.find(b => b.id === bancoSeleccionado)?.nombre}: {rifa.cuentasBancarias.find((c: CuentaBancaria) => c.bancoId === bancoSeleccionado)?.cuenta}
                    </p>
                  </div>
                )}

                {((rifa.cuentasBancarias && rifa.cuentasBancarias.length > 0 && bancoSeleccionado) || !rifa.cuentasBancarias || rifa.cuentasBancarias.length === 0) && (
                  <>
                    <div className="input-group">
                      <label>URL del Comprobante de Transferencia (Voucher)</label>
                      <input
                        type="url"
                        value={voucherUrl}
                        onChange={(e) => { setVoucherUrl(e.target.value); setVoucherFile(null); setErrorVoucher(''); }}
                        placeholder="https://ejemplo.com/voucher.png"
                        disabled={!!voucherFile || subiendoVoucher}
                      />
                    </div>
                    <div className="input-group">
                      <label>O sube una foto del comprobante (JPEG/PNG, máx. 5MB)</label>
                      <input type="file" accept="image/jpeg,image/png" onChange={handleSeleccionarArchivo} disabled={subiendoVoucher} />
                      {voucherFile && <span className="voucher-archivo-seleccionado">📎 {voucherFile.name}</span>}
                    </div>
                    {errorVoucher && <div className="mensaje-error" role="alert">{errorVoucher}</div>}
                    <button type="submit" className="auth-button" disabled={subiendoVoucher}>
                      {subiendoVoucher ? 'Subiendo comprobante...' : 'Confirmar Reserva y Subir Voucher'}
                    </button>
                  </>
                )}

                <button type="button" onClick={() => setBoletoSeleccionado(null)} className="auth-button btn-cancel" disabled={subiendoVoucher}>
                  Cancelar Selección
                </button>
              </form>
            </div>
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
    </div>
  );
};
