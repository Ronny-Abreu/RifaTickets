const { Builder, By, Key, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Función auxiliar para guardar capturas
const guardarCaptura = (imagenBase64, nombreArchivo) => {
    const ruta = path.join(screenshotsDir, nombreArchivo);
    fs.writeFileSync(ruta, imagenBase64, 'base64');
    console.log(`📸 Captura guardada: ${ruta}`);
};

const FIREBASE_API_KEY = 'AIzaSyDKuQIyIcJt637KAM97c6U9s1pu3RFFOek';
const FIREBASE_PROJECT_ID = 'rifatickets-9a19e';
const ADMIN_EMAIL = 'pruebaadmin@gmail.com';
const ADMIN_PASSWORD = 'pruebaadminITLA';
const IMAGEN_PRUEBA = path.join(__dirname, 'fixtures', 'imagen-prueba.png');
const obtenerIdTokenAdmin = async () => {
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true })
    });
    const data = await resp.json();
    if (!data.idToken) throw new Error('No se pudo autenticar vía REST para sembrar datos: ' + JSON.stringify(data));
    return data.idToken;
};

const crearRifaViaAPI = async (idToken, campos) => {
    const resp = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/rifas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ fields: campos })
    });
    if (!resp.ok) throw new Error(`Firestore REST devolvió ${resp.status} al crear la rifa de prueba.`);
    return resp.json();
};

const leerRifaViaAPI = async (idToken, rifaId) => {
    const resp = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/rifas/${rifaId}`, {
        headers: { 'Authorization': `Bearer ${idToken}` }
    });
    return resp.json();
};

(async function ejecutarPruebasE2E() {
    let driver = await new Builder().forBrowser('chrome').build();

    const APP_URL = 'http://localhost:5173';
    const runId = Date.now();

    let tituloRifaLimite = null;
    let idRifaLimite = null;
    let tituloRifaEditar = null;
    let tituloRifaEliminar = null;

    const resultados = [];
    const ejecutarPrueba = async (id, descripcion, funcionPrueba) => {
        console.log(`\nEjecutando ${id}: ${descripcion}`);
        try {
            await funcionPrueba();
            console.log(`✅ ${id} Completado Exitosamente.`);
            resultados.push({ id, descripcion, estado: 'PASÓ' });
        } catch (error) {
            console.error(`❌ ${id} Falló: ${error.message}`);
            try {
                const capturaError = await driver.takeScreenshot();
                guardarCaptura(capturaError, `${id}_ERROR.png`);
            } catch (_) {
            }
            resultados.push({ id, descripcion, estado: 'FALLÓ', error: error.message });
        }
    };

    const aceptarAlerta = async () => {
        await driver.wait(until.alertIsPresent(), 8000);
        await driver.switchTo().alert().accept();
    };
    const textoDe = async (elemento) => {
        return driver.executeScript('return arguments[0].textContent;', elemento);
    };

    const escribirCampo = async (elemento, valor) => {
        await elemento.sendKeys(Key.chord(Key.CONTROL, 'a'), String(valor));
        const actual = await elemento.getAttribute('value');
        if (actual !== String(valor)) {
            throw new Error(`El campo quedó en "${actual}" en vez de "${valor}"`);
        }
    };

    const clickSeguro = async (elementoOPromesa) => {
        const elemento = await elementoOPromesa;
        await driver.executeScript('arguments[0].scrollIntoView({block: "center", inline: "center"});', elemento);
        await driver.sleep(250);
        try {
            await elemento.click();
        } catch (error) {
            const msg = String(error);
            if (msg.includes('intercepted') || msg.includes('not clickable')) {
                await driver.executeScript('arguments[0].click();', elemento);
            } else {
                throw error;
            }
        }
    };

    const loginAdmin = async () => {
        await driver.get(`${APP_URL}/login`);
        await driver.wait(until.elementLocated(By.css('input[type="email"]')), 8000);
        await driver.findElement(By.css('input[type="email"]')).sendKeys(ADMIN_EMAIL);
        await driver.findElement(By.css('input[type="password"]')).sendKeys(ADMIN_PASSWORD);
        await clickSeguro(driver.findElement(By.css('button[type="submit"]')));
        await driver.wait(until.elementLocated(By.css('.dashboard-container')), 12000);
        await driver.wait(until.elementLocated(By.css('.rifa-form')), 8000);
    };

    const irAlDashboard = async () => {
        await driver.get(`${APP_URL}/admin-dashboard`);
        await driver.wait(until.elementLocated(By.css('.rifa-form')), 12000);
    };

    const filaDeRifa = async (titulo, timeout = 12000) => {
        return driver.wait(
            until.elementLocated(By.xpath(`//div[contains(@class,'rifa-item')][.//h4[normalize-space(.)="${titulo}"]]`)),
            timeout
        );
    };

    const llenarPaso1 = async ({ titulo, boletos, precio, conImagen = true }) => {
        await driver.findElement(By.css('.rifa-form input[type="text"]')).sendKeys(titulo);

        const inputs = await driver.findElements(By.css('.rifa-form input[type="number"]'));
        await escribirCampo(inputs[0], boletos);
        await escribirCampo(inputs[1], precio);

        if (conImagen) {
            await driver.findElement(By.css('#imagen-rifa')).sendKeys(IMAGEN_PRUEBA);
        }
        await driver.findElement(By.css('.rifa-form input[type="date"]')).sendKeys('12312026');
        await clickSeguro(driver.findElement(By.css('.rifa-form button[type="submit"]')));
    };

    // Paso 2: elige un banco, escribe la cuenta y la agrega a la lista
    const agregarCuentaBancaria = async (numeroCuenta) => {
        await driver.wait(until.elementLocated(By.css('.bank-selector')), 8000);
        const bancos = await driver.findElements(By.css('.bank-selector'));
        await clickSeguro(bancos[0]);
        await driver.findElement(By.xpath('//label[contains(.,"Número de Cuenta")]/following-sibling::input')).sendKeys(numeroCuenta);
        await clickSeguro(driver.findElement(By.xpath('//button[normalize-space(.)="Agregar Cuenta"]')));
    };

    try {
        console.log('🚀 Iniciando pruebas automatizadas de RifaTickets...');

        if (!fs.existsSync(IMAGEN_PRUEBA)) {
            throw new Error(`Falta la imagen de prueba en ${IMAGEN_PRUEBA}`);
        }

        // =========================================================
        // FLUJO: Vista Pública
        // =========================================================
        await ejecutarPrueba('CP-03', 'Visualización de Portal Público (Camino Feliz)', async () => {
            await driver.get(APP_URL);
            await driver.wait(until.elementLocated(By.css('.raffle-card')), 8000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-8_Vista_Publica_Automatizada.png');
        });

        const tituloRifaCancelada = `QA Rifa Cancelada ${runId}`;
        await ejecutarPrueba('CP-03-N', 'Una rifa cancelada no aparece en el portal público (Prueba Negativa)', async () => {
            const idToken = await obtenerIdTokenAdmin();
            await crearRifaViaAPI(idToken, {
                titulo: { stringValue: tituloRifaCancelada },
                cantidadBoletos: { integerValue: '5' },
                precioBoleto: { integerValue: '50' },
                imagenUrl: { stringValue: 'https://picsum.photos/seed/qa-cancel/400/300' },
                fechaFin: { stringValue: '2026-12-31' },
                estado: { stringValue: 'cancelada' },
                cuentasBancarias: { arrayValue: { values: [] } },
                fechaCreacion: { stringValue: new Date().toISOString() }
            });

            await driver.get(APP_URL);
            await driver.wait(until.elementLocated(By.css('.raffle-card')), 8000);
            // La Home solo lista rifas 'activa' o 'finalizada'
            const tarjetas = await driver.findElements(By.xpath(`//h3[normalize-space(.)="${tituloRifaCancelada}"]`));
            if (tarjetas.length > 0) {
                throw new Error('Una rifa con estado "cancelada" apareció en el portal público.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-8_VistaPublica_Negativa.png');
        });

        // =========================================================
        // FLUJO: Login de Administrador
        // =========================================================
        await ejecutarPrueba('CP-01', 'Login de admin con credenciales correctas (Camino Feliz)', async () => {
            await loginAdmin();
            await driver.wait(until.elementLocated(By.css('.rifa-item')), 10000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-5_Login_Exitoso_Automatizado.png');
        });

        await ejecutarPrueba('CP-01-N', 'Login con contraseña incorrecta (Prueba Negativa)', async () => {
            await driver.get(`${APP_URL}/login`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 8000);
            await driver.findElement(By.css('input[type="email"]')).sendKeys(ADMIN_EMAIL);
            await driver.findElement(By.css('input[type="password"]')).sendKeys('PasswordIncorrecta999');
            await clickSeguro(driver.findElement(By.css('button[type="submit"]')));

            await driver.wait(until.elementLocated(By.css('.auth-error')), 8000);
            const mensaje = await driver.findElement(By.css('.auth-error')).getText();
            if (!mensaje.includes('Credenciales inválidas')) {
                throw new Error(`Mensaje de error inesperado: "${mensaje}"`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-5_Login_Negativa.png');
        });

        await ejecutarPrueba('CP-01-L', 'Envío de login con el email vacío (Prueba de Límites)', async () => {
            await driver.get(`${APP_URL}/login`);
            await driver.wait(until.elementLocated(By.css('input[type="password"]')), 8000);
            await driver.findElement(By.css('input[type="password"]')).sendKeys('CualquierPassword123');
            const emailInput = await driver.findElement(By.css('input[type="email"]'));
            await clickSeguro(driver.findElement(By.css('button[type="submit"]')));

            const esValido = await driver.executeScript('return arguments[0].checkValidity();', emailInput);
            if (esValido) {
                throw new Error('El navegador permitió enviar el formulario con el email vacío.');
            }
            const urlActual = await driver.getCurrentUrl();
            if (!urlActual.includes('/login')) {
                throw new Error('La página navegó fuera de /login pese a la validación fallida.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-5_Login_Limite.png');
        });

        // =========================================================
        // FLUJO: Registro de Usuario
        // El registro crea cuentas con role 'client' y redirige al inicio.
        // =========================================================
        const emailRegistroFeliz = `qa-feliz-${runId}@rifatickets.com`;
        const llenarRegistro = async (email, password) => {
            await driver.get(`${APP_URL}/register`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 8000);
            const textos = await driver.findElements(By.css('.auth-form input[type="text"]'));
            await textos[0].sendKeys('QA Tester');                      // Nombre Completo
            await textos[1].sendKeys('001-1234567-8');                  // Cédula / Documento
            await driver.findElement(By.css('.auth-form input[type="tel"]')).sendKeys('809-555-1234');
            await driver.findElement(By.css('.auth-form input[type="email"]')).sendKeys(email);
            await driver.findElement(By.css('.auth-form input[type="password"]')).sendKeys(password);
            await clickSeguro(driver.findElement(By.css('.auth-form button[type="submit"]')));
        };

        await ejecutarPrueba('CP-02', 'Registro con datos válidos (Camino Feliz)', async () => {
            await llenarRegistro(emailRegistroFeliz, 'PasswordSeguro123');
            await driver.wait(until.elementLocated(By.css('.raffle-card')), 12000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-4_Registro_Feliz.png');
        });

        await ejecutarPrueba('CP-02-N', 'Registro con un email ya existente (Prueba Negativa)', async () => {
            await llenarRegistro(ADMIN_EMAIL, 'OtraPassword123');
            await driver.wait(until.elementLocated(By.css('.auth-error')), 8000);
            const mensaje = await driver.findElement(By.css('.auth-error')).getText();
            if (!mensaje.includes('ya está registrado')) {
                throw new Error(`Mensaje de error inesperado: "${mensaje}"`);
            }
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-4_Registro_Negativa.png');
        });

        const emailRegistroLimite = `qa-limite-${runId}@rifatickets.com`;
        await ejecutarPrueba('CP-02-L', 'Registro con contraseña de 6 caracteres, el mínimo permitido (Prueba de Límites)', async () => {
            await llenarRegistro(emailRegistroLimite, '123456'); // exactamente 6 caracteres
            await driver.wait(until.elementLocated(By.css('.raffle-card')), 12000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-4_Registro_Limite.png');
        });

        // =========================================================
        // FLUJO: Creación de Rifa en 2 pasos
        // Paso 1: datos + precio + imagen (Cloudinary) -> Continuar
        // Paso 2: banco + cuenta -> Agregar Cuenta -> Publicar Rifa
        // =========================================================
        const tituloRifaFeliz = `QA Rifa Feliz ${runId}`;
        await ejecutarPrueba('CP-04', 'Creación de rifa con precio, imagen y cuenta bancaria (Camino Feliz)', async () => {
            await loginAdmin();
            await llenarPaso1({ titulo: tituloRifaFeliz, boletos: 25, precio: 150 });

            // Paso 2: el encabezado cambia a "- Bancos (Paso 2)"
            await agregarCuentaBancaria('123456789');
            const cuentasAgregadas = await driver.findElements(By.xpath('//h4[normalize-space(.)="Cuentas Agregadas:"]'));
            if (cuentasAgregadas.length === 0) {
                throw new Error('La cuenta bancaria no se agregó a la lista del paso 2.');
            }

            await clickSeguro(driver.findElement(By.xpath('//button[normalize-space(.)="Publicar Rifa"]')));

            // La subida a Cloudinary tarda; esperamos a que la rifa aparezca en la lista
            await filaDeRifa(tituloRifaFeliz, 30000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_CrearRifa_Feliz.png');
            await driver.sleep(1500);
        });

        await ejecutarPrueba('CP-04-N', 'Intento de continuar sin seleccionar imagen (Prueba Negativa)', async () => {
            await irAlDashboard();
            const tituloSinImagen = `QA Rifa SinImagen ${runId}`;
            await driver.findElement(By.css('.rifa-form input[type="text"]')).sendKeys(tituloSinImagen);
            const inputs = await driver.findElements(By.css('.rifa-form input[type="number"]'));
            await escribirCampo(inputs[0], 20);
            await escribirCampo(inputs[1], 100);
            await driver.findElement(By.css('.rifa-form input[type="date"]')).sendKeys('12312026');

            const inputImagen = await driver.findElement(By.css('#imagen-rifa'));
            await clickSeguro(driver.findElement(By.css('.rifa-form button[type="submit"]')));

            const esValido = await driver.executeScript('return arguments[0].checkValidity();', inputImagen);
            if (esValido) {
                throw new Error('El navegador aceptó continuar sin seleccionar una imagen.');
            }
            const selectoresBanco = await driver.findElements(By.css('.bank-selector'));
            if (selectoresBanco.length > 0) {
                throw new Error('El formulario avanzó al paso 2 pese a no tener imagen.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_CrearRifa_Negativa.png');
        });

        tituloRifaLimite = `QA Rifa Limite ${runId}`;
        await ejecutarPrueba('CP-04-L', 'Creación de rifa con 10 boletos y precio 1, los mínimos permitidos (Prueba de Límites)', async () => {
            await irAlDashboard();
            await llenarPaso1({ titulo: tituloRifaLimite, boletos: 10, precio: 1 });
            await agregarCuentaBancaria('987654321');
            await clickSeguro(driver.findElement(By.xpath('//button[normalize-space(.)="Publicar Rifa"]')));

            await filaDeRifa(tituloRifaLimite, 30000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_CrearRifa_Limite.png');
            await driver.sleep(1500);
        });

        await ejecutarPrueba('CP-07', 'La imagen subida a Cloudinary se renderiza en la tarjeta pública (HU-7)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: CP-04-L no se completó.');

            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'raffle-card')][.//h3[normalize-space(.)="${tituloRifaLimite}"]]`)),
                12000
            );
            const img = await tarjeta.findElement(By.css('img.card-img'));
            const srcReal = await img.getAttribute('src');
            if (!srcReal.includes('cloudinary.com')) {
                throw new Error(`La imagen no se sirvió desde Cloudinary. src="${srcReal}"`);
            }

            // Esperamos a que la imagen realmente cargue en el navegador
            await driver.wait(async () => {
                const ancho = await driver.executeScript('return arguments[0].naturalWidth;', img);
                return ancho > 0;
            }, 15000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-7_ImagenRifa_Feliz.png');
        });

        await ejecutarPrueba('CP-03-L', 'La tarjeta pública muestra precio y total de una rifa en el mínimo (Prueba de Límites)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: CP-04-L no se completó.');

            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'raffle-card')][.//h3[normalize-space(.)="${tituloRifaLimite}"]]`)),
                12000
            );
            const texto = await textoDe(tarjeta);
            if (!/Total Boletos: 10(?![0-9])/.test(texto)) {
                throw new Error(`La tarjeta no muestra "Total Boletos: 10". Texto: "${texto}"`);
            }
            const precio = await textoDe(await tarjeta.findElement(By.css('.price-tag')));
            if (!precio.match(/\d/)) {
                throw new Error(`La tarjeta no muestra el precio por boleto. Precio: "${precio}"`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-8_VistaPublica_Limite.png');
        });

        // =========================================================
        // FLUJO: Edición de Rifa
        // =========================================================
        tituloRifaEditar = `QA Rifa Editada ${runId}`;
        await ejecutarPrueba('CP-10', 'Edición de rifa: cambiar título, precio y agregar cuenta (Camino Feliz)', async () => {
            if (!tituloRifaFeliz) throw new Error('No hay rifa disponible: CP-04 no se completó.');

            await irAlDashboard();
            const fila = await filaDeRifa(tituloRifaFeliz);
            await clickSeguro(fila.findElement(By.css('.btn-editar')));

            await driver.wait(until.elementLocated(By.css('.modal-content')), 8000);
            const inputTitulo = await driver.findElement(By.css('.modal-content input[type="text"]'));
            await escribirCampo(inputTitulo, tituloRifaEditar);

            const numeros = await driver.findElements(By.css('.modal-content input[type="number"]'));
            await escribirCampo(numeros[1], 275);

            await clickSeguro(driver.findElement(By.xpath('//button[normalize-space(.)="Guardar Cambios"]')));

            // El modal se cierra y la lista refleja el nuevo título
            await driver.wait(async () => {
                const modales = await driver.findElements(By.css('.modal-content'));
                return modales.length === 0;
            }, 20000);
            await filaDeRifa(tituloRifaEditar, 15000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_EditarRifa_Feliz.png');
            await driver.sleep(1500);
        });

        await ejecutarPrueba('CP-10-N', 'Guardar Cambios permanece deshabilitado si no se modifica nada (Prueba Negativa)', async () => {
            if (!tituloRifaEditar) throw new Error('No hay rifa disponible: CP-10 no se completó.');

            await irAlDashboard();
            const fila = await filaDeRifa(tituloRifaEditar);
            await clickSeguro(fila.findElement(By.css('.btn-editar')));
            await driver.wait(until.elementLocated(By.css('.modal-content')), 8000);

            const btnGuardar = await driver.findElement(By.xpath('//button[normalize-space(.)="Guardar Cambios"]'));
            const habilitado = await btnGuardar.isEnabled();
            if (habilitado) {
                throw new Error('El botón "Guardar Cambios" quedó habilitado sin haber ningún cambio.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_EditarRifa_Negativa.png');
            await clickSeguro(driver.findElement(By.xpath('//button[normalize-space(.)="Cancelar"]')));
        });

        // =========================================================
        // FLUJO: Eliminación de Rifa
        // =========================================================
        await ejecutarPrueba('CP-11', 'Eliminación de una rifa desde el panel admin (Camino Feliz)', async () => {
            tituloRifaEliminar = `QA Rifa Eliminar ${runId}`;
            const idToken = await obtenerIdTokenAdmin();
            await crearRifaViaAPI(idToken, {
                titulo: { stringValue: tituloRifaEliminar },
                cantidadBoletos: { integerValue: '10' },
                precioBoleto: { integerValue: '100' },
                imagenUrl: { stringValue: 'https://picsum.photos/seed/qa-del/400/300' },
                fechaFin: { stringValue: '2026-12-31' },
                estado: { stringValue: 'activa' },
                cuentasBancarias: { arrayValue: { values: [] } },
                fechaCreacion: { stringValue: new Date().toISOString() }
            });

            await irAlDashboard();
            const fila = await filaDeRifa(tituloRifaEliminar, 15000);
            await clickSeguro(fila.findElement(By.css('.btn-eliminar')));
            await aceptarAlerta(); // confirm() de "¿Eliminar la rifa...?"

            await driver.wait(async () => {
                const filas = await driver.findElements(By.xpath(`//h4[normalize-space(.)="${tituloRifaEliminar}"]`));
                return filas.length === 0;
            }, 15000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_EliminarRifa_Feliz.png');
            await driver.sleep(1500);
        });

        // =========================================================
        // FLUJO: Reserva de Boletos con modal
        // Modal: correo -> banco -> (muestra la cuenta) -> imagen -> confirmar
        // =========================================================
        const abrirModalReserva = async (indiceBoleto) => {
            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'raffle-card')][.//h3[normalize-space(.)="${tituloRifaLimite}"]]`)),
                12000
            );
            await clickSeguro(tarjeta.findElement(By.css('.ze-btn-jugar')));
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 12000);
            const boletos = await driver.findElements(By.css('.ticket-btn'));
            await clickSeguro(boletos[indiceBoleto]);
            await driver.wait(until.elementLocated(By.css('.reservation-panel')), 8000);
        };

        const llenarDatosComprador = async (nombre, correo) => {
            await driver.findElement(By.css('.reservation-panel input[type="text"]')).sendKeys(nombre);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(correo);
        };

        await ejecutarPrueba('CP-05', 'Reserva de boleto: correo, banco y voucher por archivo (Camino Feliz)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: CP-04-L no se completó.');

            await abrirModalReserva(4);
            await llenarDatosComprador('QA Comprador', `qa-comprador-${runId}@ejemplo.com`);

            const bancos = await driver.findElements(By.css('.reservation-panel img'));
            if (bancos.length === 0) throw new Error('La rifa no ofrece bancos para transferir.');
            await clickSeguro(bancos[0]);

            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="file"]')), 8000);
            await driver.findElement(By.css('.reservation-panel input[type="file"]')).sendKeys(IMAGEN_PRUEBA);
            await driver.wait(until.elementLocated(By.css('.voucher-archivo-seleccionado')), 5000);

            await clickSeguro(driver.findElement(By.css('.reservation-panel button[type="submit"]')));

            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 30000);
            await driver.wait(async () => {
                const stats = await driver.findElements(By.css('.stat-value'));
                if (stats.length < 2) return false;
                return parseInt(await stats[1].getText(), 10) >= 1;
            }, 15000, 'El contador "En validación" no reflejó la reserva recién hecha');

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-10-11_ReservaBoletos_Feliz.png');
            await driver.sleep(1500);
        });

        await ejecutarPrueba('CP-05-N', 'Intento de reservar sin seleccionar banco (Prueba Negativa)', async () => {
            await abrirModalReserva(2);
            await llenarDatosComprador('QA Sin Banco', `qa-sin-banco-${runId}@ejemplo.com`);
            const archivos = await driver.findElements(By.css('.reservation-panel input[type="file"]'));
            if (archivos.length > 0) {
                throw new Error('Los campos de comprobante aparecieron sin haber elegido banco.');
            }
            const submits = await driver.findElements(By.css('.reservation-panel button[type="submit"]'));
            if (submits.length > 0) {
                throw new Error('El botón de confirmar reserva aparece sin haber elegido banco.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-10-11_ReservaBoletos_Negativa.png');
            await clickSeguro(driver.findElement(By.css('.btn-cancel')));
        });

        await ejecutarPrueba('CP-05-L', 'Reserva de los boletos en los extremos de la matriz #1 y #10 (Prueba de Límites)', async () => {
            const reservarBoleto = async (indice, correo) => {
                await abrirModalReserva(indice);
                await llenarDatosComprador(`QA Limite ${runId}`, correo);
                const bancos = await driver.findElements(By.css('.reservation-panel img'));
                await clickSeguro(bancos[0]);
                await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="file"]')), 8000);
                await driver.findElement(By.css('.reservation-panel input[type="file"]')).sendKeys(IMAGEN_PRUEBA);
                await clickSeguro(driver.findElement(By.css('.reservation-panel button[type="submit"]')));
                await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 30000);
                await driver.sleep(1500);
            };

            await reservarBoleto(0, `qa-limite-1-${runId}@ejemplo.com`);
            await reservarBoleto(9, `qa-limite-10-${runId}@ejemplo.com`);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-10-11_ReservaBoletos_Limite.png');
        });

        // =========================================================
        // FLUJO: Validación Administrativa de Comprobantes
        // =========================================================
        const reservarBoletoParaAdmin = async (indice, correo) => {
            await abrirModalReserva(indice);
            await llenarDatosComprador('QA Validacion', correo);
            const bancos = await driver.findElements(By.css('.reservation-panel img'));
            await clickSeguro(bancos[0]);
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="file"]')), 8000);
            await driver.findElement(By.css('.reservation-panel input[type="file"]')).sendKeys(IMAGEN_PRUEBA);
            await clickSeguro(driver.findElement(By.css('.reservation-panel button[type="submit"]')));
            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 30000);
            await driver.sleep(1500);
        };

        await ejecutarPrueba('CP-06', 'Aprobar un comprobante pendiente desde el panel admin (Camino Feliz)', async () => {
            await reservarBoletoParaAdmin(5, `qa-aprobar-${runId}@ejemplo.com`);

            await irAlDashboard();
            const fila = await filaDeRifa(tituloRifaLimite);
            await clickSeguro(fila.findElement(By.css('.btn-reservas')));

            const filaBoleto = await driver.wait(
                until.elementLocated(By.xpath('//section[@id="reservas-section"]//h4[normalize-space(.)="Boleto #6"]/ancestor::div[2]')),
                15000
            );
            await clickSeguro(filaBoleto.findElement(By.xpath('.//button[normalize-space(.)="Aprobar"]')));
            await aceptarAlerta();
            await driver.wait(async () => {
                const restantes = await driver.findElements(By.xpath('//section[@id="reservas-section"]//h4[normalize-space(.)="Boleto #6"]'));
                return restantes.length === 0;
            }, 15000);

            await driver.sleep(1500);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-12_ValidacionAdmin_Feliz.png');
        });

        await ejecutarPrueba('CP-06-N', 'Rechazar un comprobante libera el boleto (Prueba Negativa)', async () => {
            await reservarBoletoParaAdmin(6, `qa-rechazar-${runId}@ejemplo.com`);

            await irAlDashboard();
            const fila = await filaDeRifa(tituloRifaLimite);
            await clickSeguro(fila.findElement(By.css('.btn-reservas')));

            const filaBoleto = await driver.wait(
                until.elementLocated(By.xpath('//section[@id="reservas-section"]//h4[normalize-space(.)="Boleto #7"]/ancestor::div[2]')),
                15000
            );
            await clickSeguro(filaBoleto.findElement(By.xpath('.//button[normalize-space(.)="Rechazar"]')));
            await aceptarAlerta();
            await driver.sleep(1500);
            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'raffle-card')][.//h3[normalize-space(.)="${tituloRifaLimite}"]]`)),
                12000
            );
            await clickSeguro(tarjeta.findElement(By.css('.ze-btn-jugar')));
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 12000);
            const boletos = await driver.findElements(By.css('.ticket-btn'));
            const clase7 = await boletos[6].getAttribute('class');
            if (!clase7.includes('ticket-disponible')) {
                throw new Error(`El boleto #7 no volvió a estar disponible tras rechazarlo (clase: "${clase7}").`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-12_ValidacionAdmin_RechazoLibera.png');
        });

        // =========================================================
        // FLUJO: Confirmación de Compra en Tiempo Real
        // =========================================================
        await ejecutarPrueba('CP-09', 'Confirmación de compra en tiempo real sin recargar (Camino Feliz)', async () => {
            await reservarBoletoParaAdmin(7, `qa-tiempo-real-${runId}@ejemplo.com`);
            const tabPublica = await driver.getWindowHandle();

            // Pestaña B: panel admin, sin cerrar la pública
            await driver.switchTo().newWindow('tab');
            const tabAdmin = await driver.getWindowHandle();
            await irAlDashboard();
            const fila = await filaDeRifa(tituloRifaLimite);
            await clickSeguro(fila.findElement(By.css('.btn-reservas')));

            const filaBoleto = await driver.wait(
                until.elementLocated(By.xpath('//section[@id="reservas-section"]//h4[normalize-space(.)="Boleto #8"]/ancestor::div[2]')),
                15000
            );
            await clickSeguro(filaBoleto.findElement(By.xpath('.//button[normalize-space(.)="Aprobar"]')));
            await aceptarAlerta();
            await driver.sleep(1500);
            await driver.switchTo().window(tabPublica);
            await driver.wait(async () => {
                const botones = await driver.findElements(By.css('.ticket-btn'));
                const clase = await botones[7].getAttribute('class');
                return clase.includes('ticket-comprado');
            }, 20000);

            const stats = await driver.findElements(By.css('.stat-value'));
            const disponibles = parseInt(await stats[0].getText(), 10);
            const pendientes = parseInt(await stats[1].getText(), 10);
            const comprados = parseInt(await stats[2].getText(), 10);
            if (comprados < 1) {
                throw new Error(`El contador "Comprados" no reflejó la aprobación: ${comprados}`);
            }
            if (disponibles + pendientes + comprados !== 10) {
                throw new Error(`Los contadores no suman 10. D=${disponibles}, P=${pendientes}, C=${comprados}`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-13_ConfirmacionCompra_Feliz.png');

            await driver.switchTo().window(tabAdmin);
            await driver.close();
            await driver.switchTo().window(tabPublica);
        });

        // =========================================================
        // FLUJO: Verificador de Boletos (/verificador)
        // Elegir dinámica -> escribir número -> Buscar -> reservado o no
        // =========================================================
        await ejecutarPrueba('CP-08', 'Verificador encuentra un boleto reservado (Camino Feliz)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: CP-04-L no se completó.');

            await driver.get(`${APP_URL}/verificador`);
            const select = await driver.wait(until.elementLocated(By.css('.verificador-select')), 12000);
            await driver.wait(async () => {
                const opciones = await select.findElements(By.xpath(`.//option[normalize-space(.)="${tituloRifaLimite}"]`));
                return opciones.length > 0;
            }, 12000);
            await clickSeguro(select.findElement(By.xpath(`.//option[normalize-space(.)="${tituloRifaLimite}"]`)));

            const input = await driver.wait(until.elementLocated(By.css('.verificador-input')), 8000);
            await input.sendKeys('1');
            await clickSeguro(driver.findElement(By.xpath('//button[contains(normalize-space(.),"BUSCAR")]')));

            const tarjeta = await driver.wait(until.elementLocated(By.css('.verificador-result-card')), 15000);
            const texto = await textoDe(tarjeta);
            if (!texto.includes('Reservado')) {
                throw new Error(`El verificador no marcó el boleto como reservado. Texto: "${texto}"`);
            }
            if (!texto.includes(`QA Limite ${runId}`)) {
                throw new Error(`El verificador no muestra el nombre del comprador. Texto: "${texto}"`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'Verificador_Feliz.png');
        });

        await ejecutarPrueba('CP-08-N', 'Verificador con un boleto no reservado (Prueba Negativa)', async () => {
            await driver.get(`${APP_URL}/verificador`);
            const select = await driver.wait(until.elementLocated(By.css('.verificador-select')), 12000);
            await driver.wait(async () => {
                const opciones = await select.findElements(By.xpath(`.//option[normalize-space(.)="${tituloRifaLimite}"]`));
                return opciones.length > 0;
            }, 12000);
            await clickSeguro(select.findElement(By.xpath(`.//option[normalize-space(.)="${tituloRifaLimite}"]`)));

            const input = await driver.wait(until.elementLocated(By.css('.verificador-input')), 8000);
            await input.sendKeys('4');
            await clickSeguro(driver.findElement(By.xpath('//button[contains(normalize-space(.),"BUSCAR")]')));

            const sinResultado = await driver.wait(until.elementLocated(By.css('.verificador-no-result')), 15000);
            const texto = await textoDe(sinResultado);
            if (!texto.includes('no encontrado')) {
                throw new Error(`Mensaje inesperado para un boleto libre: "${texto}"`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'Verificador_Negativa.png');
        });

        await ejecutarPrueba('CP-08-L', 'Verificador exige elegir dinámica antes de buscar (Prueba de Límites)', async () => {
            await driver.get(`${APP_URL}/verificador`);
            await driver.wait(until.elementLocated(By.css('.verificador-select')), 12000);

            const inputs = await driver.findElements(By.css('.verificador-input'));
            if (inputs.length > 0) {
                throw new Error('El campo de número de boleto aparece sin haber elegido dinámica.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'Verificador_Limite.png');
        });

        // =========================================================
        // Resumen final
        // =========================================================
        console.log('\n📊 Resumen de Ejecución:');
        resultados.forEach(r => {
            const icono = r.estado === 'PASÓ' ? '✅' : '❌';
            console.log(`${icono} ${r.id} — ${r.descripcion}: ${r.estado}`);
        });
        const fallidas = resultados.filter(r => r.estado === 'FALLÓ').length;
        console.log(`\nTotal: ${resultados.length} | Pasaron: ${resultados.length - fallidas} | Fallaron: ${fallidas}`);
        if (fallidas > 0) process.exitCode = 1;

    } catch (error) {
        console.error('❌ Error inesperado fuera de las pruebas individuales:', error);
        process.exitCode = 1;
    } finally {
        // Cerrar el navegador al terminar
        console.log('\n🏁 Pruebas finalizadas. Cerrando navegador...');
        await driver.quit();
    }
})();
