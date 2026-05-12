# AS-BUILT ARCHITECTURE: MedOps Portal
**Versión:** 1.3 (Mayo 2026 - Security Hardened)
**Estado:** Producción / Estable

## 1. Módulo de Seguridad y Usuarios (Hardening)
Se ha migrado la gestión de usuarios a una arquitectura de **Edge Functions** para garantizar la integridad de las sesiones administrativas y permitir un control total sobre el ciclo de vida de los usuarios.

### 1.1 Edge Function: `manage-users` (Hardened)
*   **Propósito:** Actuar como puente entre el frontend y el SDK de Admin de Supabase.
*   **Acciones Soportadas:** `create`, `update`, `delete`.
*   **Seguridad:** 
    *   **Autenticación:** Requiere un JWT válido en el header `Authorization`.
    *   **RBAC (Control de Acceso):** Solo los usuarios con rol `Superadmin` o `Administrador` (verificados en la tabla `profiles`) pueden ejecutar estas acciones.
    *   **Privilegios:** Utiliza la `SERVICE_ROLE_KEY` internamente para operaciones administrativas solo después de validar al llamador.

### 1.2 Triggers de Limpieza
*   `on_profile_deleted`: Dispara la eliminación en Auth cuando se borra un registro en `profiles`.
*   **Aislamiento:** Los usuarios con rol `Cirujano` tienen registros automáticos en la tabla `surgeons`, vinculados por `user_id`.

### 1.3 Row Level Security (RLS)
*   **Hardening:** Se han eliminado todas las políticas basadas en `auth.role() = 'authenticated'` para operaciones sensibles.
*   **Audit Logs:** El `INSERT` está restringido a personal interno con roles operativos para prevenir spoofing de logs.
*   **Catálogos:** Las tablas `hospitals`, `surgeons` y `trays` solo son visibles para personal administrativo y técnico.

## 2. Gestión de Aseguradoras (ARS)
Se integró un sistema de gestión de prestadoras de salud enfocado en el mercado de República Dominicana.

### 2.1 Modelo de Datos
*   **Tabla `ars`:** Almacena los nombres de las aseguradoras (Senasa, Humano, Universal, etc.).
*   **Relación:** La tabla `surgeries` posee una clave foránea `ars_id` hacia la tabla `ars`.

### 2.2 Funcionalidad Administrativa
*   Ubicada en **Configuración > Catálogo ARS**.
*   **Políticas RLS:** Escritura restringida exclusivamente a roles `Superadmin` y `Administrador`.

## 3. Flujo de Trabajo de Cirugías
*   **Creación:** Obligatoriedad de seleccionar una ARS para cada paciente.
*   **Alertas:** Envío automático de notificaciones vía correo si la cirugía se programa para las próximas 48 horas (Urgente).
*   **Impresión:** Generación dinámica de Hoja de Entrega (PDF) incluyendo datos del Cirujano, Hospital y Bandejas requeridas.

## 4. Input Sanitization y DTOs
Se ha implementado una capa de seguridad en los servicios de datos para prevenir inyecciones y ataques de Mass Assignment:
*   **DTOs (Data Transfer Objects):** Los servicios de `configService` y `surgeryService` filtran explícitamente los campos permitidos antes de enviarlos a la base de datos o Edge Functions.
*   **Native REST Security:** La construcción de queries manuales utiliza `URLSearchParams` para evitar inyección de parámetros PostgREST.

## 5. Stack Tecnológico
*   **Frontend:** React 19 + Vite.
*   **Backend:** Supabase (Postgres + Auth + Edge Functions).
*   **Seguridad:** RBAC + RLS Hardening + DTO Validation.

## 6. Analítica Financiera e Inventario (Visibility & Logistics)
Se ha implementado un sistema de visibilidad de costos y control de reposición para optimizar la rentabilidad operativa.

### 6.1 Gestión de Costos Unitarios
*   **Inventario:** Se añadieron campos de `unit_cost` (costo de adquisición) y `min_stock` (punto de reorden) a la tabla de implantes.
*   **Importación Masiva:** El flujo de importación desde Excel soporta el mapeo dinámico de estos campos para una carga eficiente de catálogos.

### 6.2 Reporte de Gasto Quirúrgico
*   **Lógica de Integridad:** El reporte financiero filtra estrictamente las cirugías por estado `Completada`. Esto garantiza que los costos reportados correspondan a consumos reales y finales.
*   **Agregación Dual:** 
    *   **Vista Logística:** Agrupa consumos por `productId` para facilitar la reposición de inventario.
    *   **Vista Financiera:** Agrupa consumos por `surgeryId` (Paciente) para calcular el costo total de cada procedimiento.

### 6.3 Sistema de Alertas de Inventario
*   **Vencimientos:** Monitoreo dinámico de fechas de caducidad. El sistema genera alertas visuales detalladas indicando el nombre del producto y el lote afectado.
*   **Stock Crítico:** Cálculo en tiempo real de faltantes basado en el `min_stock` definido por producto.

### 6.4 Restricciones Operativas
*   **Bloqueo de Gasto:** El botón para registrar consumo está deshabilitado hasta que la cirugía cambie su estatus a `Completada`. Esto asegura que la analítica financiera no contenga datos parciales o en borrador.

### 6.5 Analytics Pro (Inteligencia de Negocios Avanzada)
*   **Rentabilidad por Hospital:** El panel financiero (`Reportes.jsx`) agrupa los consumos utilizando el `hospital_id` extraído mediante un `Inner Join` en el servicio `implantService`. Se utiliza un gráfico de barras apiladas para comparar simultáneamente el **Costo** y el **Margen Bruto** generado por cada centro médico.
*   **Facturación por Cirujano:** Visualiza el volumen de facturación generado por especialista para análisis de desempeño.
*   **Limpieza de Dashboard:** Se ha eliminado la redundancia de datos (ej. duplicidad de estado de inventario) para focalizar la interfaz en alertas críticas centralizadas.
*   **Reportes de Lotes (Inventario):** Implementación de controles interactivos con reset de filtros (`RotateCcw`) y *feedback* de carga (`RefreshCw`).

## 7. Flujos Revertidos (Decisiones de Negocio)
*   **Actas Quirúrgicas (Firma Digital):** Se exploró la funcionalidad de firma en dispositivo (Canvas API), pero fue revertida. El proceso se mantiene ágil permitiendo la descarga inmediata del PDF pre-formateado con la línea de firma física/sello.

---
*Este documento es la única fuente de verdad sobre la implementación actual de la arquitectura de MedOps.*
