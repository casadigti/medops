# AS-BUILT ARCHITECTURE: MedOps Portal
**Versión:** 1.4 (Mayo 2026 - Logistics & Analytics Pro)
**Estado:** Producción / Estable / Build Verificado

## 1. Módulo de Seguridad y Usuarios (Hardening)
Se ha migrado la gestión de usuarios a una arquitectura de **Edge Functions** para garantizar la integridad de las sesiones administrativas y permitir un control total sobre el ciclo de vida de los usuarios.

### 1.1 Edge Function: `manage-users` (Hardened)
*   **Propósito:** Actuar como puente entre el frontend y el SDK de Admin de Supabase.
*   **Seguridad:** Requiere JWT válido y validación de rol `Superadmin`/`Administrador` en la tabla `profiles`.

### 1.2 Row Level Security (RLS)
*   **Hardening:** Eliminación de políticas genéricas. Acceso granular basado en roles operativos.
*   **Cirujanos:** Vinculación automática entre `auth.users` y la tabla `surgeons` mediante el campo `user_id`.

## 2. Gestión de Inventario y Logística (Predictive & Hardened)
El sistema ha evolucionado de un registro estático a una herramienta de planificación logística.

### 2.1 Inteligencia de Reposición (Días de Stock)
*   **Métrica Logística:** Implementación del cálculo `Stock Actual / Consumo Diario Promedio`. 
*   **Alertas Predictivas:** Visualización de badges de colores que indican cuántos días de stock quedan antes de la ruptura, permitiendo compras proactivas.
*   **Sincronización:** Las alertas de inventario del Dashboard están 100% sincronizadas con el panel de notificaciones y el menú lateral.

### 2.2 Gestión de Lotes y Vencimientos
*   **Trazabilidad:** Monitoreo dinámico de fechas de caducidad con alertas automáticas a los 90 días del vencimiento.
*   **Integridad de Consumo:** El servicio `implantService.reportConsumption` valida el stock por lote antes de permitir el registro del gasto quirúrgico.

## 3. Sistema de Reportes y PDF (Professional Export)
### 3.1 Motor de Impresión (`printService.js`)
*   **Tecnología:** Uso de `jsPDF` y `jspdf-autotable`.
*   **Reportes Disponibles:** 
    *   Hoja de Entrega Quirúrgica.
    *   Reporte de Gasto y Reposición Financiera (con desglose por producto y cirugía).
*   **Branding:** Generación automatizada con encabezados corporativos, fechas localizadas y totales monetarios formateados (RD$).

## 4. Calendario Quirúrgico y Agenda
### 4.1 Personalización por Especialista
*   **Filtro por Cirujano:** Selector dinámico que permite filtrar la agenda global para visualizar únicamente las cirugías de un especialista.
*   **Resaltado Visual:** Los eventos pertenecientes al cirujano seleccionado se destacan con una prioridad visual (border-ring y opacidad ajustada) para facilitar la lectura rápida de la agenda.

## 5. Analítica de Negocios (Analytics Pro)
### 5.1 Rentabilidad y Márgenes
*   **Análisis por Hospital:** Comparativa de **Costo vs Margen Bruto** mediante gráficos de barras apiladas, permitiendo identificar los centros médicos más rentables.
*   **Mix de Facturación (ARS):** Desglose porcentual de la facturación por aseguradora para análisis de cartera.
*   **Frecuencia de Implantes:** Identificación de los insumos de mayor rotación por cirujano para optimización de negociaciones con proveedores.

## 6. Stack Tecnológico y Build
*   **Core:** React 19 + Vite 6 + TailwindCSS 4.
*   **PWA:** Service Worker activo para persistencia y notificaciones en dispositivos móviles.
*   **Build Pipeline:** Verificado exitosamente con `npm run build`, garantizando que el paquete de producción está libre de errores de sintaxis y dependencias circulares.

---
*Este documento es la única fuente de verdad sobre la implementación actual de la arquitectura de MedOps. Actualizado tras el build exitoso de Mayo 2026.*
