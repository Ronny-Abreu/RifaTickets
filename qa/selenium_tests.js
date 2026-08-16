const { Builder, By, until } = require('selenium-webdriver');
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

(async function ejecutarPruebasE2E() {
    let driver = await new Builder().forBrowser('chrome').build();

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

        // =========================================================
        // FLUJO: Login de Administrador (HU-2)
        // =========================================================
        await ejecutarPrueba('CP-01', 'Login con credenciales correctas (Camino Feliz)', async () => {
            await driver.get(`${APP_URL}/login`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 5000);
            await driver.findElement(By.css('input[type="email"]')).sendKeys('test-admin-hu4-2@rifatickets.com');
            await driver.findElement(By.css('input[type="password"]')).sendKeys('TestPass123!');
            await driver.findElement(By.css('button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.css('.dashboard-container')), 5000);
            await driver.wait(until.elementLocated(By.css('.rifa-item')), 5000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-2_Login_Exitoso_Automatizado.png');
        });

        await ejecutarPrueba('CP-01-N', 'Login con contraseña incorrecta (Prueba Negativa)', async () => {
            await driver.get(`${APP_URL}/login`);
            await driver.wait(until.elementLocated(By.css('input[type="email"]')), 5000);
            await driver.findElement(By.css('input[type="email"]')).sendKeys('test-admin-hu4-2@rifatickets.com');
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
            await driver.findElement(By.css('input[type="email"]')).sendKeys('test-admin-hu4-2@rifatickets.com');
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
            await driver.findElement(By.css('input[type="password"]')).sendKeys('123456');
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

        // =========================================================
        // FLUJO: Reserva de Boletos (HU-9, HU-10, HU-11)
        // Usamos "QA Rifa Limite" (10 boletos, creada arriba) como escenario:
        // así los boletos #1 y #10 de la prueba de límites son sus extremos reales.
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
            await boletos[4].click();
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-comprador-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();

            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);
            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-9_ReservaBoletos_Feliz.png');
        });

        await ejecutarPrueba('CP-05-N', 'Envío de reserva con el correo vacío (Prueba Negativa)', async () => {
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
            guardarCaptura(captura, 'HU-9_ReservaBoletos_Negativa.png');
        });

        await ejecutarPrueba('CP-05-L', 'Reserva de los boletos en los extremos de la matriz #1 y #10 (Prueba de Límites)', async () => {
            await driver.navigate().refresh();
            await driver.wait(until.elementLocated(By.css('.tickets-grid')), 5000);
            let boletos = await driver.findElements(By.css('.ticket-btn'));
            const totalBoletos = boletos.length;

            await boletos[0].click();
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-limite-1-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher-1.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();
            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);

            boletos = await driver.findElements(By.css('.ticket-btn'));
            await boletos[totalBoletos - 1].click();
            await driver.wait(until.elementLocated(By.css('.reservation-panel input[type="email"]')), 5000);
            await driver.findElement(By.css('.reservation-panel input[type="email"]')).sendKeys(`qa-limite-${totalBoletos}-${runId}@ejemplo.com`);
            await driver.findElement(By.css('.reservation-panel input[type="url"]')).sendKeys('https://example.com/qa-voucher-fin.png');
            await driver.findElement(By.css('.reservation-panel button[type="submit"]')).click();
            await driver.wait(until.elementLocated(By.css('.mensaje-exito')), 5000);

            const captura = await driver.takeScreenshot();
            guardarCaptura(captura, 'HU-9_ReservaBoletos_Limite.png');

            await driver.sleep(1500);
        });

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
        console.log('\n🏁 Pruebas finalizadas. Cerrando navegador...');
        await driver.quit();
    }
})();
