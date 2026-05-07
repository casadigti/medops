# AS-BUILT ARCHITECTURE: MedOps Portal
**Versión:** 1.2 (Mayo 2026)
**Estado:** Producción / Estable

## 1. Módulo de Seguridad y Usuarios (Hardening)
Se ha migrado la gestión de usuarios a una arquitectura de **Edge Functions** para garantizar la integridad de las sesiones administrativas y permitir un control total sobre el ciclo de vida de los usuarios.

### 1.1 Edge Function: `manage-users`
*   **Propósito:** Actuar como puente entre el frontend y el SDK de Admin de Supabase.
*   **Acciones Soportadas:**
    *   `create`: Crea usuarios en `auth.users` sin cerrar la sesión del administrador. Confirmación automática de email habilitada.
    *   `update`: Permite sobrescribir nombres, roles y **contraseñas** directamente por el administrador.
    *   `delete`: Borrado físico y definitivo del usuario de la base de datos de Autenticación.
*   **Seguridad:** Ejecutada con `SECURITY DEFINER` y requiere la `SERVICE_ROLE_KEY`.

### 1.2 Triggers de Limpieza
*   `on_profile_deleted`: Dispara la eliminación en Auth cuando se borra un registro en `profiles`.
*   **Aislamiento:** Los usuarios con rol `Cirujano` tienen registros automáticos en la tabla `surgeons`, vinculados por `user_id`.

## 2. Gestión de Aseguradoras (ARS)
Se integró un sistema de gestión de prestadoras de salud enfocado en el mercado de República Dominicana.

### 2.1 Modelo de Datos
*   **Tabla `ars`:** Almacena los nombres de las aseguradoras (Senasa, Humano, Universal, etc.).
*   **Relación:** La tabla `surgeries` posee una clave foránea `ars_id` hacia la tabla `ars`.

### 2.2 Funcionalidad Administrativa
*   Ubicada en **Configuración > Catálogo ARS**.
*   Permite: Agregar nuevas ARS, **Editar nombres en línea** y Eliminar aseguradoras inactivas.
*   **Políticas RLS:** Lectura pública para usuarios autenticados; Escritura restringida a roles `Superadmin` y `Administrador`.

## 3. Flujo de Trabajo de Cirugías
*   **Creación:** Obligatoriedad de seleccionar una ARS para cada paciente.
*   **Alertas:** Envío automático de notificaciones vía correo si la cirugía se programa para las próximas 48 horas (Urgente).
*   **Impresión:** Generación dinámica de Hoja de Entrega (PDF) incluyendo datos del Cirujano, Hospital y Bandejas requeridas.

## 4. Stack Tecnológico
*   **Frontend:** React 18 + Vite.
*   **Backend:** Supabase (PostgreSQL + Auth + Edge Functions).
*   **Estilos:** Vanilla CSS (Design System personalizado).
*   **Observabilidad:** Vercel Analytics + Speed Insights.

---
*Este documento es la única fuente de verdad sobre la implementación actual de la arquitectura de MedOps.*
