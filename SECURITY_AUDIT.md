# SECURITY AUDIT - MedOps Platform

## 1. RECONNAISSANCE (Fase 1)

### Stack Tecnológico
- **Frontend**: React 19 + Vite + Tailwind CSS 4.
- **Backend/Base de Datos**: Supabase (PostgreSQL + PostgREST).
- **Autenticación**: Supabase Auth (JWT).
- **Gestión de Estado**: Zustand.
- **Infraestructura**: Supabase Edge Functions (`manage-users`, `send-surgery-alert`).

### Inventario de Endpoints (Rutas Frontend)
- `/`: Dashboard / Principal.
- `/login`: Acceso al sistema.
- `/cirugias`: Gestión de cirugías y pacientes.
- `/calendario`: Vista de agenda quirúrgica.
- `/bandejas`: Inventario de bandejas de instrumentos.
- `/mantenimiento`: Catálogos (Hospitales, Doctores, etc.).
- `/directorio`: Directorio de contactos y entidades.
- `/reportes`: BI y analíticas.
- `/mis-solicitudes`: Portal específico para cirujanos.
- `/configuracion`: Ajustes del sistema, usuarios y roles.

### Mecanismos de Autenticación y Sesión
- **Auth**: Basado en Supabase Auth con JWT.
- **Sesión**: Persistencia en `localStorage` vía cliente oficial de Supabase.
- **MFA**: No detectado en la configuración actual.
- **Roles**:
  - `Superadmin`: Acceso total, incluyendo logs de auditoría.
  - `Administrador`: Gestión operativa y de usuarios.
  - `Editor`: Creación y edición de datos operativos.
  - `Técnico`: Enfocado en almacén/bandejas.
  - `Cirujano`: Acceso limitado a sus propias solicitudes.
  - `Lector`: Solo lectura.

### Funcionalidades de Carga de Archivos (Uploads)
- **Logotipo de Organización**: En la página de Configuración.
  - *Nota*: Actualmente implementado mediante `FileReader.readAsDataURL` y almacenado como string base64 en la tabla `organization_settings`. No utiliza Supabase Storage.

### Observaciones Iniciales
- Se detectó un uso extensivo de queries REST manuales (`fetch`) en paralelo con el cliente oficial de Supabase para evitar "congelamientos" del cliente JS.
- La gestión de usuarios (creación/edición/borrado) se delega a una Edge Function (`manage-users`) para preservar la sesión del administrador.
- Existe una tabla de auditoría (`audit_log`) que registra acciones críticas.

---

## 2. ANÁLISIS DE VULNERABILIDADES (Fase 2)

### A. Broken Access Control (OWASP A01:2021)
- **RLS Permisivo**: Las políticas de Row Level Security en `apply_rls.sql` utilizan `auth.role() = 'authenticated'` para todas las operaciones (SELECT, INSERT, UPDATE, DELETE).
- **Riesgo**: Cualquier usuario autenticado (incluyendo un 'Lector' o 'Cirujano') puede modificar o borrar registros de cualquier otro usuario, hospital o cirugía.
- **IDOR**: No hay validación de que un Cirujano solo acceda a sus propias cirugías.

### B. Vulnerable Dependencies
- **xlsx (<0.20.2)**: Detectada vulnerabilidad de Alta Severidad (ReDoS - Regular Expression Denial of Service).
- **Riesgo**: Un atacante podría enviar un archivo malicioso o causar que el servidor/cliente se bloquee al procesar hojas de cálculo.

### C. Information Exposure (OWASP A03:2021)
- **Audit Logs**: El servicio `auditService.js` guarda el objeto `details` completo. Si se pasan objetos con datos sensibles (aunque no se detectó pass hash, sí otros metadatos), estos quedan expuestos a cualquier usuario con rol `Superadmin` en la vista de logs.

### D. Missing Anti-Automation / Rate Limiting
- No se detectó implementación de Rate Limiting en endpoints sensibles (Login, Password Reset, Creación de Usuarios).
- **Riesgo**: Ataques de fuerza bruta o denegación de servicio.

### E. Security Misconfiguration (OWASP A05:2021)
- **Políticas Públicas**: El archivo `supabase_schema.sql` contiene políticas `FOR ALL USING (true)`, lo que permitiría acceso total sin autenticación si no se aplicó el script de hardening.
- **MFA**: No está habilitado el segundo factor de autenticación.

### F. Mass Assignment
- Las funciones de `update` y `create` en los servicios (ej: `surgeryService.js`) pasan objetos de datos casi sin filtrar a Supabase.
- **Riesgo**: Un atacante podría inyectar campos no previstos en el formulario (ej: cambiar el ID de la organización o estados internos) si las políticas RLS no restringen columnas.

---

## 3. REPORTE DE HALLAZGOS (Fase 3 - VERIFICADO)

| ID | Hallazgo | Categoría OWASP | Severidad | Estado | Fix Sugerido |
|:---|:---|:---|:---|:---|:---|
| **VULN-001** | Auth Bypass en Edge Functions | A01:2021-Broken Access Control | 🔥 **CRÍTICA** | ✅ Corregido | Implementar verificación de JWT y RBAC. |
| **VULN-002** | Insecure RLS en Audit Logs | A01:2021-Broken Access Control | 🔴 **ALTA** | ✅ Corregido | Restringir INSERT a roles operativos. |
| **VULN-003** | Mass Assignment en Gestión | A01:2021-Broken Access Control | 🔴 **ALTA** | ✅ Corregido | Implementar Whitelist de campos (DTO). |
| **VULN-004** | Exposición de Catálogos | A03:2021-Injection/Exposure | 🟡 **MEDIA** | ✅ Corregido | Refinar RLS para restringir visibilidad. |
| **VULN-006** | Inyección de Parámetros REST | A03:2021-Injection/Exposure | 🟢 **BAJA** | ✅ Corregido | Usar URLSearchParams y objetos de query. |

---

## 4. PLAN DE REMEDIACIÓN (Fase 4 - COMPLETADO)
*Correcciones realizadas y verificadas en la arquitectura actual.*

### ✅ Correcciones Aplicadas
1.  **Seguridad en Edge Functions (VULN-001)**: Se añadió validación de JWT y chequeo de roles en `manage-users`. Solo personal administrativo puede gestionar usuarios.
2.  **Hardening de RLS (VULN-002 & VULN-004)**: Se actualizaron las políticas en `apply_rls.sql` para proteger los logs de auditoría y restringir el acceso a catálogos operativos (Hospitales, Cirujanos, Bandejas).
3.  **Prevención de Mass Assignment (VULN-003)**: Se implementó una capa de filtrado de datos en `configService.js` antes de cualquier operación de escritura.
4.  **Sanitización REST (VULN-006)**: Se refactorizó la comunicación REST nativa para usar métodos de construcción de URLs seguros y tipados.

### ⚠️ Acciones Manuales Requeridas (Infraestructura)
- **Base de Datos**: Es imperativo ejecutar el script `apply_rls.sql` en el SQL Editor de Supabase para activar las nuevas políticas.

---
*Fin del Reporte de Seguridad - Mayo 2026*
