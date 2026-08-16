# Contexto del Proyecto: RifaTickets MVP

## Descripción del Sistema
RifaTickets es una plataforma web transaccional diseñada para gestionar rifas de forma ágil. Permite a los administradores crear sorteos y gestionar comprobantes de pago, mientras que los usuarios públicos pueden ver la disponibilidad de boletos en tiempo real y realizar simulaciones de compra.

## Roles del Sistema
1. **Administrador:** Capacidad de crear rifas, subir imágenes, establecer límites de boletos y aprobar/rechazar comprobantes de pago.
2. **Usuario Público:** Capacidad de visualizar rifas activas, seleccionar boletos (bloqueándolos para otros) y subir comprobantes (vouchers).

## Listado de Features (Release 1)
* **Módulo de Autenticación:** 
  * Registro e inicio de sesión exclusivo para administradores.
* **Dashboard Administrativo:**
  * Formulario de creación de rifas (Título, cantidad de boletos, tope de inicio, imagen).
  * Panel de revisión de vouchers pendientes con acciones de "Aprobar" o "Rechazar".
* **Portal Público en Tiempo Real:**
  * Grid de rifas activas.
  * Vista de detalle de rifa con contador de tiempo y matriz de boletos disponibles.
  * Sincronización en vivo (< 2 segundos de latencia) de la disponibilidad de boletos mediante Firestore.
  * Flujo de reserva: Selección de boleto -> Cambio de estado a "Pendiente" -> Subida de voucher -> Espera de validación.