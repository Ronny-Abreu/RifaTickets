const { Builder, By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

// Asegurar que exista la carpeta de capturas
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

// --- Datos de acceso a Firebase de este entorno ---
const FIREBASE_API_KEY = 'AIzaSyDKuQIyIcJt637KAM97c6U9s1pu3RFFOek';
const FIREBASE_PROJECT_ID = 'rifatickets-9a19e';
const ADMIN_EMAIL = 'test-admin-hu4-2@rifatickets.com';
const ADMIN_PASSWORD = 'TestPass123!';
const obtenerIdTokenAdmin = async () => {
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true })
    });
    const data = await resp.json();
    if (!data.idToken) throw new Error('No se pudo autenticar vía REST para sembrar datos de prueba: ' + JSON.stringify(data));
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

(async function ejecutarPruebasE2E() {
    // Configuración del navegador
    let driver = await new Builder().forBrowser('chrome').build();

    // Configuración de la URL de la aplicación
    const APP_URL = 'http://localhost:5173';

    const runId = Date.now();

    let tituloRifaLimite = null;

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
        await driver.wait(until.alertIsPresent(), 5000);
        await driver.switchTo().alert().accept();
    };

    try {
        console.log('🚀 Iniciando pruebas automatizadas de RifaTickets...');

        // =========================================================
        // FLUJO: Vista Pública (HU-8)
        // =========================================================
        await ejecutarPrueba('CP-03', 'Visualización de Portal Público (Camino Feliz)', async () => {
            await driver.get(APP_URL);
            await driver.wait(until.elementLocated(By.css('.rifa-card')), 5000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-8_Vista_Publica_Automatizada.png');
        });

        const tituloRifaInactiva = `QA Rifa Inactiva ${runId}`;
        await ejecutarPrueba('CP-03-N', 'Una rifa inactiva no aparece en el portal público (Prueba Negativa)', async () => {
            const idToken = await obtenerIdTokenAdmin();
            await crearRifaViaAPI(idToken, {
                titulo: { stringValue: tituloRifaInactiva },
                cantidadBoletos: { integerValue: '5' },
                imagenUrl: { stringValue: 'https://example.com/qa-inactiva.jpg' },
                fechaFin: { stringValue: '2026-12-31' },
                estado: { stringValue: 'inactiva' },
                fechaCreacion: { stringValue: new Date().toISOString() }
            });

            await driver.get(APP_URL);
            await driver.wait(until.elementLocated(By.css('.rifa-card')), 5000);
            const tarjetasInactivas = await driver.findElements(By.xpath(`//h3[text()="${tituloRifaInactiva}"]`));
            if (tarjetasInactivas.length > 0) {
                throw new Error('Una rifa con estado "inactiva" apareció en el portal público.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-8_VistaPublica_Negativa.png');
        });

        // =========================================================
        // FLUJO: Login de Administrador (HU-5)
        // =========================================================
        await ejecutarPrueba('CP-01', 'Login con credenciales correctas (Camino Feliz)', async () => {
            await driver.get(`${APP_URL}/login`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 5000);
            await driver.findElement(By.css('input[type="email"]')).sendKeys(ADMIN_EMAIL);
            await driver.findElement(By.css('input[type="password"]')).sendKeys(ADMIN_PASSWORD);
            await driver.findElement(By.css('button[type="submit"]')).click();
            await driver.wait(until.elementLocated(By.css('.dashboard-container')), 5000);
            await driver.wait(until.elementLocated(By.css('.rifa-item')), 5000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-2_Login_Exitoso_Automatizado.png');
        });

        await ejecutarPrueba('CP-01-N', 'Login con contraseña incorrecta (Prueba Negativa)', async () => {
            await driver.get(`${APP_URL}/login`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 5000);
            await driver.findElement(By.css('input[type="email"]')).sendKeys(ADMIN_EMAIL);
            await driver.findElement(By.css('input[type="password"]')).sendKeys('PasswordIncorrecta999');
            await driver.findElement(By.css('button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.css('.auth-error')), 5000);
            const mensaje = await driver.findElement(By.css('.auth-error')).getText();
            if (!mensaje.includes('Credenciales inválidas')) {
                throw new Error(`Mensaje de error inesperado: "${mensaje}"`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-2_Login_Negativa.png');
        });

        await ejecutarPrueba('CP-01-L', 'Envío de login con el email vacío (Prueba de Límites)', async () => {
            await driver.get(`${APP_URL}/login`);
            await driver.wait(until.elementLocated(By.css('input[type="password"]')), 5000);
            await driver.findElement(By.css('input[type="password"]')).sendKeys('CualquierPassword123');
            const emailInput = await driver.findElement(By.css('input[type="email"]'));
            await driver.findElement(By.css('button[type="submit"]')).click();

            // El campo requerido debe bloquear el envío antes de llegar a Firebase
            const esValido = await driver.executeScript('return arguments[0].checkValidity();', emailInput);
            if (esValido) {
                throw new Error('El navegador permitió enviar el formulario con el email vacío.');
            }
            const urlActual = await driver.getCurrentUrl();
            if (!urlActual.includes('/login')) {
                throw new Error('La página navegó fuera de /login pese a la validación fallida.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-2_Login_Limite.png');
        });

        // =========================================================
        // FLUJO: Registro de Administrador (HU-4)
        // =========================================================
        const emailRegistroFeliz = `qa-feliz-${runId}@rifatickets.com`;
        await ejecutarPrueba('CP-02', 'Registro con email nuevo y contraseña válida (Camino Feliz)', async () => {
            await driver.get(`${APP_URL}/register`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 5000);
            await driver.findElement(By.css('input[type="email"]')).sendKeys(emailRegistroFeliz);
            await driver.findElement(By.css('input[type="password"]')).sendKeys('PasswordSeguro123');
            await driver.findElement(By.css('button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.css('.dashboard-container')), 5000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-4_Registro_Feliz.png');
        });

        await ejecutarPrueba('CP-02-N', 'Registro con un email ya existente (Prueba Negativa)', async () => {
            await driver.get(`${APP_URL}/register`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 5000);
            await driver.findElement(By.css('input[type="email"]')).sendKeys(ADMIN_EMAIL);
            await driver.findElement(By.css('input[type="password"]')).sendKeys('OtraPassword123');
            await driver.findElement(By.css('button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.css('.auth-error')), 5000);
            const mensaje = await driver.findElement(By.css('.auth-error')).getText();
            if (!mensaje.includes('email-already-in-use')) {
                throw new Error(`Mensaje de error inesperado: "${mensaje}"`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-4_Registro_Negativa.png');
        });

        const emailRegistroLimite = `qa-limite-${runId}@rifatickets.com`;
        await ejecutarPrueba('CP-02-L', 'Registro con contraseña de 6 caracteres, el mínimo de Firebase (Prueba de Límites)', async () => {
            await driver.get(`${APP_URL}/register`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 5000);
            await driver.findElement(By.css('input[type="email"]')).sendKeys(emailRegistroLimite);
            await driver.findElement(By.css('input[type="password"]')).sendKeys('123456'); // exactamente 6 caracteres
            await driver.findElement(By.css('button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.css('.dashboard-container')), 5000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-4_Registro_Limite.png');
        });

        // =========================================================
        // FLUJO: Creación de Rifa (HU-6)
        // =========================================================
        const tituloRifaFeliz = `QA Rifa Feliz ${runId}`;
        await ejecutarPrueba('CP-04', 'Creación de rifa con datos válidos (Camino Feliz)', async () => {
            await driver.get(`${APP_URL}/admin-dashboard`);
            await driver.wait(until.elementLocated(By.css('.rifa-form')), 5000);
            await driver.findElement(By.css('.rifa-form input[type="text"]')).sendKeys(tituloRifaFeliz);
            const cantidadInput = await driver.findElement(By.css('.rifa-form input[type="number"]'));
            await cantidadInput.clear();
            await cantidadInput.sendKeys('25');
            await driver.findElement(By.css('.rifa-form input[type="url"]')).sendKeys('https://example.com/qa-rifa-feliz.jpg');
            await driver.findElement(By.css('.rifa-form input[type="date"]')).sendKeys('12312026');
            await driver.findElement(By.css('.rifa-form button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.xpath(`//h4[text()="${tituloRifaFeliz}"]`)), 5000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_CrearRifa_Feliz.png');
            await driver.sleep(1500);
        });

        const tituloRifaNegativa = `QA Rifa Negativa ${runId}`;
        await ejecutarPrueba('CP-04-N', 'Creación de rifa con URL de imagen inválida (Prueba Negativa)', async () => {
            await driver.get(`${APP_URL}/admin-dashboard`);
            await driver.wait(until.elementLocated(By.css('.rifa-form')), 5000);
            await driver.findElement(By.css('.rifa-form input[type="text"]')).sendKeys(tituloRifaNegativa);
            const cantidadInput = await driver.findElement(By.css('.rifa-form input[type="number"]'));
            await cantidadInput.clear();
            await cantidadInput.sendKeys('20');
            const urlInput = await driver.findElement(By.css('.rifa-form input[type="url"]'));
            await urlInput.sendKeys('esto-no-es-una-url');
            await driver.findElement(By.css('.rifa-form input[type="date"]')).sendKeys('12312026');
            await driver.findElement(By.css('.rifa-form button[type="submit"]')).click();

            const esUrlValida = await driver.executeScript('return arguments[0].checkValidity();', urlInput);
            if (esUrlValida) {
                throw new Error('El navegador aceptó una URL de imagen con formato inválido.');
            }
            const rifasCreadas = await driver.findElements(By.xpath(`//h4[text()="${tituloRifaNegativa}"]`));
            if (rifasCreadas.length > 0) {
                throw new Error('La rifa se creó en Firestore pese a tener una URL inválida.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_CrearRifa_Negativa.png');
        });

        tituloRifaLimite = `QA Rifa Limite ${runId}`;
        await ejecutarPrueba('CP-04-L', 'Creación de rifa con 10 boletos, el mínimo permitido (Prueba de Límites)', async () => {
            await driver.get(`${APP_URL}/admin-dashboard`);
            await driver.wait(until.elementLocated(By.css('.rifa-form')), 5000);
            await driver.findElement(By.css('.rifa-form input[type="text"]')).sendKeys(tituloRifaLimite);
            const cantidadInput = await driver.findElement(By.css('.rifa-form input[type="number"]'));
            await cantidadInput.clear();
            await cantidadInput.sendKeys('10');
            await driver.findElement(By.css('.rifa-form input[type="url"]')).sendKeys('https://example.com/qa-rifa-limite.jpg');
            await driver.findElement(By.css('.rifa-form input[type="date"]')).sendKeys('12312026');
            await driver.findElement(By.css('.rifa-form button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.xpath(`//h4[text()="${tituloRifaLimite}"]`)), 5000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-6_CrearRifa_Limite.png');
            await driver.sleep(1500);
        });

        const tituloRifaImagen = `QA Rifa Imagen ${runId}`;
        const imagenUrlReal = `https://picsum.photos/seed/qa-${runId}/400/300`;
        await ejecutarPrueba('CP-07', 'La imagen representativa se renderiza correctamente en la tarjeta pública (Camino Feliz)', async () => {
            await driver.get(`${APP_URL}/admin-dashboard`);
            await driver.wait(until.elementLocated(By.css('.rifa-form')), 5000);
            await driver.findElement(By.css('.rifa-form input[type="text"]')).sendKeys(tituloRifaImagen);
            const cantidadInput = await driver.findElement(By.css('.rifa-form input[type="number"]'));
            await cantidadInput.clear();
            await cantidadInput.sendKeys('15');
            await driver.findElement(By.css('.rifa-form input[type="url"]')).sendKeys(imagenUrlReal);
            await driver.findElement(By.css('.rifa-form input[type="date"]')).sendKeys('12312026');
            await driver.findElement(By.css('.rifa-form button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.xpath(`//h4[text()="${tituloRifaImagen}"]`)), 5000);
            await driver.sleep(1500);

            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'rifa-card')][.//h3[text()="${tituloRifaImagen}"]]`)),
                5000
            );
            const img = await tarjeta.findElement(By.css('img.rifa-img'));
            const srcReal = await img.getAttribute('src');
            if (srcReal !== imagenUrlReal) {
                throw new Error(`El src de la imagen no coincide. Esperado "${imagenUrlReal}", obtenido "${srcReal}"`);
            }
            await driver.wait(async () => {
                const ancho = await driver.executeScript('return arguments[0].naturalWidth;', img);
                return ancho > 0;
            }, 8000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-7_ImagenRifa_Feliz.png');
        });

        // =========================================================
        // FLUJO: Vista Pública, prueba de límites (HU-8)
        // Depende de "QA Rifa Limite" (10 boletos, creada en CP-04-L).
        // =========================================================
        await ejecutarPrueba('CP-03-L', 'La tarjeta pública muestra los datos exactos de una rifa en el mínimo de boletos (Prueba de Límites)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: la prueba CP-04-L no se completó.');

            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'rifa-card')][.//h3[text()="${tituloRifaLimite}"]]`)),
                5000
            );
            const texto = await tarjeta.getText();
            if (!texto.includes('10 Boletos')) {
                throw new Error(`La tarjeta no muestra "10 Boletos" para la rifa del mínimo permitido. Texto: "${texto}"`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-8_VistaPublica_Limite.png');
        });

        // =========================================================
        // FLUJO: Reserva de Boletos (HU-10, HU-11)
        // Usamos "QA Rifa Limite" (10 boletos) como escenario: así los
        // boletos #1 y #10 de la prueba de límites son sus extremos reales.
        // =========================================================
        await ejecutarPrueba('CP-05', 'Reserva de un boleto disponible (Camino Feliz)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: la prueba CP-04-L no se completó.');

            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'rifa-card')][.//h3[text()="${tituloRifaLimite}"]]`)),
                5000
            );
            await tarjeta.findElement(By.css('.btn-participar')).click();
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 5000);

            const boletos = await driver.findElements(By.css('.ticket-btn'));
            await boletos[4].click(); // boleto #5: un boleto intermedio para el camino feliz
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-comprador-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);

            // HU-9: el contador "En validación" debe reflejar la reserva recién hecha
            const pendientesTxt = await driver.findElement(By.css('.stat-pendientes')).getText();
            if (!/[1-9]/.test(pendientesTxt)) {
                throw new Error(`El contador "En validación" no reflejó la reserva recién hecha: "${pendientesTxt}"`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-10-11_ReservaBoletos_Feliz.png');
        });

        await ejecutarPrueba('CP-05-N', 'Envío de reserva con el correo vacío (Prueba Negativa)', async () => {
            // Seguimos en la misma rifa; el boleto #3 sigue disponible
            const boletos = await driver.findElements(By.css('.ticket-btn'));
            await boletos[2].click();
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="url"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher-neg.png');
            const emailInput = await driver.findElement(By.css('.reservation-panel input[type="email"]'));
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();

            const esValido = await driver.executeScript('return arguments[0].checkValidity();', emailInput);
            if (esValido) {
                throw new Error('El navegador permitió reservar el boleto sin correo electrónico.');
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-10-11_ReservaBoletos_Negativa.png');
        });

        await ejecutarPrueba('CP-05-L', 'Reserva de los boletos en los extremos de la matriz #1 y #10 (Prueba de Límites)', async () => {
            await driver.navigate().refresh();
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 5000);
            let boletos = await driver.findElements(By.css('.ticket-btn'));
            const totalBoletos = boletos.length;

            // Extremo inferior: boleto #1
            await boletos[0].click();
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-limite-1-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher-1.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();
            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);

            // Extremo superior: último boleto (#10)
            boletos = await driver.findElements(By.css('.ticket-btn'));
            await boletos[totalBoletos - 1].click();
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-limite-${totalBoletos}-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher-fin.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();
            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-10-11_ReservaBoletos_Limite.png');

            await driver.sleep(1500);
        });

        // =========================================================
        // FLUJO: Validación Administrativa de Comprobantes (HU-12)
        // Usa boletos independientes de "QA Rifa Limite" (#6 y #7) para no
        // interferir con los ya reservados en el bloque anterior (#1, #3, #5, #10).
        // =========================================================
        await ejecutarPrueba('CP-06', 'Aprobar un comprobante pendiente desde el panel admin (Camino Feliz)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: la prueba CP-04-L no se completó.');

            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'rifa-card')][.//h3[text()="${tituloRifaLimite}"]]`)),
                5000
            );
            await tarjeta.findElement(By.css('.btn-participar')).click();
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 5000);
            const boletos = await driver.findElements(By.css('.ticket-btn'));
            await boletos[5].click();
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-aprobar-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher-aprobar.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();
            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);
            await driver.sleep(1500);

            await driver.get(`${APP_URL}/admin-dashboard`);
            const filaRifa = await driver.wait(
                until.elementLocated(By.xpath(`//div[contains(@class,'rifa-item')][.//h4[text()="${tituloRifaLimite}"]]`)),
                8000
            );
            await filaRifa.findElement(By.css('button')).click();

            const filaBoleto = await driver.wait(
                until.elementLocated(By.xpath('//h4[normalize-space(.)="Boleto #6"]/ancestor::div[2]')),
                8000
            );
            await filaBoleto.findElement(By.xpath('.//button[text()="Aprobar"]')).click();
            await aceptarAlerta();

            // El boleto aprobado ya no debe listarse como pendiente de validación
            await driver.wait(async () => {
                const restantes = await driver.findElements(By.xpath('//h4[normalize-space(.)="Boleto #6"]'));
                return restantes.length === 0;
            }, 5000);

            await driver.sleep(1500);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-12_ValidacionAdmin_Feliz.png');
        });

        await ejecutarPrueba('CP-06-N', 'Rechazar un comprobante libera el boleto (Prueba Negativa)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: la prueba CP-04-L no se completó.');

            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'rifa-card')][.//h3[text()="${tituloRifaLimite}"]]`)),
                5000
            );
            await tarjeta.findElement(By.css('.btn-participar')).click();
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 5000);
            let boletos = await driver.findElements(By.css('.ticket-btn'));
            await boletos[6].click(); // boleto #7
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-rechazar-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher-rechazar.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();
            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);
            await driver.sleep(1500);

            await driver.get(`${APP_URL}/admin-dashboard`);
            const filaRifa = await driver.wait(
                until.elementLocated(By.xpath(`//div[contains(@class,'rifa-item')][.//h4[text()="${tituloRifaLimite}"]]`)),
                8000
            );
            await filaRifa.findElement(By.css('button')).click();

            const filaBoleto = await driver.wait(
                until.elementLocated(By.xpath('//h4[normalize-space(.)="Boleto #7"]/ancestor::div[2]')),
                8000
            );
            await filaBoleto.findElement(By.xpath('.//button[text()="Rechazar"]')).click();
            await aceptarAlerta();
            await driver.sleep(1500);

            // Verificamos en la vista pública que el boleto #7 volvió a estar disponible
            await driver.get(APP_URL);
            const tarjeta2 = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'rifa-card')][.//h3[text()="${tituloRifaLimite}"]]`)),
                5000
            );
            await tarjeta2.findElement(By.css('.btn-participar')).click();
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 5000);
            boletos = await driver.findElements(By.css('.ticket-btn'));
            const clase7 = await boletos[6].getAttribute('class');
            if (!clase7.includes('ticket-disponible')) {
                throw new Error(`El boleto #7 no volvió a estar disponible tras rechazarlo (clase actual: "${clase7}").`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-12_ValidacionAdmin_RechazoLibera.png');
        });

        await ejecutarPrueba('CP-09', 'Confirmación de compra en tiempo real sin recargar (Camino Feliz)', async () => {
            if (!tituloRifaLimite) throw new Error('No hay rifa disponible: la prueba CP-04-L no se completó.');

            // Pestaña A: reservamos el boleto #8 desde la vista pública y la dejamos abierta
            await driver.get(APP_URL);
            const tarjeta = await driver.wait(
                until.elementLocated(By.xpath(`//article[contains(@class,'rifa-card')][.//h3[text()="${tituloRifaLimite}"]]`)),
                5000
            );
            await tarjeta.findElement(By.css('.btn-participar')).click();
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 5000);
            const boletos = await driver.findElements(By.css('.ticket-btn'));
            await boletos[7].click(); // boleto #8
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-tiempo-real-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher-tr.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();
            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);
            await driver.sleep(1500);

            const tabPublica = await driver.getWindowHandle();

            // Pestaña B: panel admin, en una ventana nueva (sin cerrar la pública)
            await driver.switchTo().newWindow('tab');
            const tabAdmin = await driver.getWindowHandle();
            await driver.get(`${APP_URL}/admin-dashboard`);
            const filaRifa = await driver.wait(
                until.elementLocated(By.xpath(`//div[contains(@class,'rifa-item')][.//h4[text()="${tituloRifaLimite}"]]`)),
                8000
            );
            await filaRifa.findElement(By.css('button')).click();

            const filaBoleto = await driver.wait(
                until.elementLocated(By.xpath('//h4[normalize-space(.)="Boleto #8"]/ancestor::div[2]')),
                8000
            );
            await filaBoleto.findElement(By.xpath('.//button[text()="Aprobar"]')).click();
            await aceptarAlerta();
            await driver.sleep(1500);

            // Volvemos a la pestaña pública SIN recargar y confirmamos que reaccionó sola.
            await driver.switchTo().window(tabPublica);
            await driver.wait(async () => {
                const botones = await driver.findElements(By.css('.ticket-btn'));
                const clase = await botones[7].getAttribute('class');
                return clase.includes('ticket-comprado');
            }, 15000);

            // HU-9: los contadores numéricos también deben reflejar el cambio en tiempo real
            const disponiblesTxt = await driver.findElement(By.css('.stat-disponibles')).getText();
            const pendientesTxt = await driver.findElement(By.css('.stat-pendientes')).getText();
            const compradosTxt = await driver.findElement(By.css('.stat-comprados')).getText();
            const extraerNumero = (txt) => parseInt(txt.match(/\d+/)[0], 10);
            const disponibles = extraerNumero(disponiblesTxt);
            const pendientes = extraerNumero(pendientesTxt);
            const comprados = extraerNumero(compradosTxt);
            if (comprados < 1) {
                throw new Error(`El contador "Comprados" no reflejó la aprobación en tiempo real: "${compradosTxt}"`);
            }
            if (disponibles + pendientes + comprados !== 10) {
                throw new Error(`Los contadores no suman el total de boletos (10). Disponibles=${disponibles}, Pendientes=${pendientes}, Comprados=${comprados}`);
            }

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-13_ConfirmacionCompra_Feliz.png');

            // Limpieza: cerramos la pestaña admin y dejamos el foco en la pública
            await driver.switchTo().window(tabAdmin);
            await driver.close();
            await driver.switchTo().window(tabPublica);
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
