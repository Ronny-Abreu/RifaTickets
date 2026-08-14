# Estrategia de Pruebas Automatizadas con Selenium

## Objetivo
Garantizar la estabilidad de los flujos críticos (Happy Paths) del sistema RifaTickets antes de su integración a la rama `main`, capturando evidencia automática para el entregable.

## Entorno y Herramientas
* **Framework:** Selenium WebDriver.
* **Lenguaje:** JavaScript.
* **Salida Esperada:** Capturas de pantalla (`.png`) automáticas tras la ejecución de aserciones clave, almacenadas en la carpeta `/qa/evidencias/`.

## Casos de Prueba a Automatizar

### CP-01: Autenticación de Administrador (HU-2)
* **Pasos:** Navegar a `/login` -> Ingresar credenciales válidas -> Hacer clic en "Entrar".
* **Aserción:** Verificar que la URL cambie a `/admin-dashboard` y que un elemento del panel sea visible.
* **Evidencia:** Captura de pantalla del dashboard cargado exitosamente.

### CP-02: Creación de Rifa Exitosa (HU-3)
* **Pasos:** Desde el dashboard, llenar formulario de nueva rifa (Título, boletos, fecha) -> Clic en "Crear".
* **Aserción:** Verificar la aparición del mensaje de éxito o la nueva tarjeta de rifa en la lista administrativa.
* **Evidencia:** Captura de pantalla del mensaje de confirmación.

### CP-03: Reserva de Boleto Público (HU-7)
* **Pasos:** Navegar a la vista de una rifa activa -> Clic en un boleto con estado "Disponible".
* **Aserción:** Verificar que el estado visual del boleto cambie y se habilite el botón para subir comprobante.
* **Evidencia:** Captura de pantalla del boleto reservado.

## Proceso de Reporte
Las capturas generadas por estos scripts serán subidas manualmente como archivos adjuntos a las respectivas Historias de Usuario en Jira para validar el cumplimiento de los Criterios de Aceptación.