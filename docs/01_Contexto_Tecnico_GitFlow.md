# Contexto Técnico y Flujo de Trabajo (GitFlow)

## Stack Tecnológico
* **Frontend:** React.js.
* **Estilos:** HTML y código CSS en archivos separados (sin frameworks de utilidades para mantener el diseño a medida y el código limpio).
* **Backend / Base de Datos:** Firebase (Firestore para base de datos en tiempo real y Auth para autenticación).
* **Pruebas:** Selenium WebDriver (Automatización E2E).
* **Gestión:** Jira.

## Estrategia de Ramas (GitFlow)
El repositorio sigue una estructura estricta para asegurar la calidad del código antes de llegar a producción:
1. `main`: Rama de producción. Solo recibe código estable y probado.
2. `qa`: Rama de pruebas. Aquí se ejecutan los scripts de Selenium.
3. `dev`: Rama principal de integración de desarrollo.
4. `feature/[ID-Jira]`: Ramas temporales para cada nueva funcionalidad (Ej. `feature/HU-4-registro-admin`).
5. `hotfix/[ID-Jira]`: Ramas para correcciones urgentes.

## Fases de Implementación y Tiempos
* **Fase 1 (Completada):** Planificación, configuración de Jira y creación de épicas/historias (2 horas).
* **Fase 2 (Actual - Jueves):** Documentación del Plan de Pruebas, archivos Markdown y configuración de repositorio (2 horas).
* **Fase 3 (Viernes):** Desarrollo de vistas públicas y conexión con Firebase Auth/Firestore (2 horas).
* **Fase 4 (Sábado):** Desarrollo del Dashboard de Administrador y validación de comprobantes (2 horas).
* **Fase 5 (Domingo):** Automatización de pruebas con Selenium e integración a la rama QA (4 horas).
* **Fase 6 (Lunes):** Pruebas E2E manuales en `main`, grabación de video de incremento y entrega (14 horas disponibles).