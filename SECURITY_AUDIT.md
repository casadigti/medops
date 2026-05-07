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

## 3. REPORTE DE HALLAZGOS (Fase 3)

| ID | Hallazgo | Categoría OWASP | Severidad | Archivo:Línea | Riesgo | Fix Sugerido |
|:---|:---|:---|:---|:---|:---|:---|
| **VULN-001** | RLS Broad Authenticated Access | A01:2021-Broken Access Control | **CRÍTICA** | `apply_rls.sql` | Cualquier usuario puede borrar/editar datos de otros (IDOR masivo). | Refinar RLS usando `auth.uid()` y chequeo de roles en tabla `profiles`. |
| **VULN-002** | ReDoS in `xlsx` library | A06:2021-Vulnerable Components | **ALTA** | `package.json:39` | Denegación de Servicio procesando archivos maliciosos. | Actualizar `xlsx` a v0.20.2+. |
| **VULN-003** | Public Access Policies | A05:2021-Security Misconfig | **ALTA** | `supabase_schema.sql:98-103` | Si se despliega este esquema, los datos son públicos. | Eliminar políticas "Public Access" y forzar RLS restrictivo. |
| **VULN-004** | Lack of MFA | A07:2021-Auth Failures | **MEDIA** | `src/lib/supabase.js` | Robo de cuentas mediante phishing o fuerza bruta. | Implementar Supabase MFA. |
| **VULN-005** | Excessive Data Exposure in Audit | A03:2021-Injection/Exposure | **BAJA** | `auditService.js:18` | Fuga de metadatos sensibles en logs. | Sanitizar el objeto `details` antes de insertar en `audit_logs`. |
| **VULN-006** | Mass Assignment in Surgery | A01:2021-Broken Access Control | **BAJA** | `surgeryService.js:71` | Manipulación de campos ocultos. | Usar DTOs o filtrar explícitamente las keys permitidas en el objeto. |

---

## 4. PLAN DE REMEDIACIÓN (Fase 4 - Pendiente OK)
*Las correcciones se realizarán en la rama `security/audit-fixes` una vez aprobado el reporte.*
