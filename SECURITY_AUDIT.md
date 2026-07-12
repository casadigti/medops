# SECURITY AUDIT — MedOps
**Fecha:** 2026-05-21 | **Estado:** Fases 1+2 completadas | **Total hallazgos:** 16

---

## INVENTARIO DEL STACK (Fase 1)

### Tecnologías principales
| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | React + Vite | 19 / 6 |
| Auth | Supabase JS | 2.105.1 |
| Router | React Router | 7 |
| State | Zustand | 5 |
| PDF | jsPDF + jspdf-autotable | 4 / 5 |
| Excel | xlsx (SheetJS CDN) | 0.20.3 |
| Validation | Zod | 4 |

### Superficie de Ataque
- Supabase REST `/rest/v1/*` — CRUD completo
- Supabase Auth `/auth/v1/*` — signIn, signUp, updateUser
- Edge Functions: `manage-users`, `send-surgery-alert`
- Realtime: `postgres_changes` en tabla `notifications`
- REST fallback manual en `surgeryService.ts`

### Auth / Sesiones
- JWT via Supabase, `persistSession: true` (localStorage)
- Sin MFA, sin lockout, sin rate limiting en login
- Contraseña mínima: 6 caracteres
- Guard de rutas: solo client-side

---

## HALLAZGOS (Fase 2 — ordenados por severidad)

---

### 🔴 CRITICO — F-01: Stored XSS via document.write
**OWASP:** A03:2021 Injection (XSS) | **Archivo:** `src/pages/Reportes.tsx:469-473`

Datos de DB (`r.surgeon`, `r.topImplant`, `r.sku`) interpolados sin escapado en `win.document.write()`. Cualquier usuario que pueda editar un cirujano o implante puede almacenar HTML/JS que ejecuta al abrir el reporte.

**PoC:** Nombre de cirujano `Dr. García<img src=x onerror=alert(1)>` → ejecuta JS en ventana de impresión.

**Fix:**
```typescript
function escapeHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
          .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
// Aplicar a r.surgeon, r.topImplant, r.sku antes de interpolar
```

---

### 🔴 CRITICO — F-02: Credenciales de produccion en git
**OWASP:** A02:2021 Cryptographic Failures | **Archivo:** `e2e/fixtures/mockData.ts:1-2`

`SUPABASE_URL` y `PROJECT_REF` de produccion hardcodeados en codigo versionado. Con URL + anon key (ya en historial git) un atacante puede llamar la API directamente eludiendo el frontend.

**Fix (sin rotar key):** Usar variables de entorno en tests e2e:
```typescript
export const SUPABASE_URL = process.env['SUPABASE_URL'] ?? 'http://localhost:54321';
export const PROJECT_REF = process.env['SUPABASE_PROJECT_REF'] ?? 'local';
```
**ACCION MANUAL:** Verificar RLS activo en TODAS las tablas. Con anon key expuesta, RLS es la única barrera.

---

### 🟠 ALTO — F-03: Math.random() para contraseñas temporales
**OWASP:** A02:2021 | **Archivo:** `src/services/surgeonService.ts:58-60`

`Math.random()` no es criptográficamente seguro. Contraseñas temporales de cirujanos son predecibles si el atacante conoce el timestamp de creación.

**Fix:**
```typescript
const arr = new Uint32Array(10);
crypto.getRandomValues(arr);
const tempPassword = Array.from(arr, n => chars[n % chars.length]).join('');
```

---

### 🟠 ALTO — F-04: Sin rate limiting ni lockout en login
**OWASP:** A07:2021 | **Archivo:** `src/pages/Login.tsx`

Fuerza bruta ilimitada. Sin delay, CAPTCHA, ni bloqueo tras N intentos fallidos.

**Fix código:** Contador de intentos con backoff exponencial y bloqueo temporal local.
**ACCION MANUAL:** Supabase Dashboard → Authentication → Rate Limits. Habilitar CAPTCHA (hCaptcha / Cloudflare Turnstile).

---

### 🟠 ALTO — F-05: Dependencias vulnerables (npm audit)
**OWASP:** A06:2021

| Paquete | Severidad | CVSS | Tipo |
|---------|----------|------|------|
| `@babel/plugin-transform-modules-systemjs` | HIGH | 8.2 | Código arbitrario (CWE-94) |
| `fast-uri` | HIGH | 7.5 | Path traversal (CWE-22) |
| `serialize-javascript` (via `@rollup/plugin-terser`) | HIGH | — | Code injection |
| `brace-expansion` | MODERATE | 6.5 | DoS (CWE-400) |

**Fix:** `npm audit fix` en raíz del proyecto. Verificar que el build siga pasando.

---

### 🟠 ALTO — F-06: Supply chain — xlsx desde CDN externo
**OWASP:** A06:2021 | **Archivo:** `package.json`

`"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"` — si el CDN es comprometido, código malicioso se instala durante `npm install`. Sin hash de integridad verificado.

**Decisión:** NO migrar al registry npm. SheetJS dejó de publicar en npmjs; la última versión ahí es `0.18.5`, con CVEs conocidos (prototype pollution GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9) corregidos recién en `0.20.2`. Bajar a `0.18.5` empeoraría la seguridad. La versión actual `0.20.3` del CDN es la parcheada.

**Acción:** Mantener `0.20.3`. `package-lock.json` ya fija el hash de integridad del tarball una vez instalado. RIESGO RESIDUAL ACEPTADO — monitorear avisos de SheetJS y considerar `exceljs` si se requiere proveedor del registry npm (cambio de API mayor).

---

### 🟡 MEDIO — F-07: Política de contraseñas débil (mínimo 6 chars)
**OWASP:** A07:2021 | **Archivo:** `src/components/auth/ForcePasswordChange.tsx`

App maneja datos médicos sensibles. 6 caracteres es insuficiente.

**Fix:** Mínimo 12 chars + mayúscula + minúscula + número + carácter especial.
**ACCION MANUAL:** Supabase Dashboard → Authentication → Password strength.

---

### 🟡 MEDIO — F-08: Race condition en stock de implantes
**OWASP:** A04:2021 Insecure Design | **Archivo:** `src/services/implantService.ts:65-85`

`reportConsumption` hace read-check-write no atómico. Dos requests concurrentes pueden ambas pasar la verificación y over-consumir stock (double-spend de inventario médico).

**Fix:** RPC PostgreSQL con transacción atómica:
```sql
CREATE FUNCTION consume_lot(p_lot_id uuid, p_qty int) RETURNS void AS $$
BEGIN
  UPDATE implant_lots SET current_quantity = current_quantity - p_qty
  WHERE id = p_lot_id AND current_quantity >= p_qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stock insuficiente'; END IF;
END; $$ LANGUAGE plpgsql;
```
```typescript
await supabase.rpc('consume_lot', { p_lot_id: implant_lot_id, p_qty: quantity_used });
```

---

### 🟡 MEDIO — F-09: Sin allowlist en hospitalService / surgeonService
**OWASP:** A04:2021 Mass Assignment
**Archivos:** `src/services/hospitalService.ts:19`, `src/services/surgeonService.ts:33`

`update()` acepta `Partial<T>` completo sin filtrar campos. A diferencia de `surgeryService` (que usa `pickAllowed()`), cualquier campo puede sobrescribirse.

**Fix:** Agregar allowlist de campos permitidos, igual que `surgeryService.pickAllowed()`.

---

### 🟡 MEDIO — F-10: Sin CSP / Security Headers
**OWASP:** A05:2021 Security Misconfiguration

Sin `Content-Security-Policy`: XSS de F-01 tiene impacto máximo. Sin `X-Frame-Options`: clickjacking posible. No existe `vercel.json`. `vite.config.js` no configura headers.

**Fix:** Crear `vercel.json`:
```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "X-Frame-Options", "value": "DENY" },
      { "key": "X-Content-Type-Options", "value": "nosniff" },
      { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
      { "key": "Content-Security-Policy", "value": "default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';" }
    ]
  }]
}
```

---

### 🟡 MEDIO — F-11: IDOR en notificationService.markAsRead
**OWASP:** A01:2021 Broken Access Control | **Archivo:** `src/services/notificationService.ts:21-26`

`UPDATE notifications ... WHERE id=?` sin filtrar por `user_id`. Si RLS mal configurado, usuario autenticado puede marcar notificaciones ajenas.

**Fix:** Agregar `.eq('user_id', user.id)` al query.
**ACCION MANUAL:** Verificar RLS: `USING (user_id = auth.uid())`.

---

### 🟢 BAJO — F-12: dangerouslySetInnerHTML en Calendario
**OWASP:** A03:2021 | **Archivo:** `src/pages/Calendario.tsx:188`

CSS estático hardcodeado, sin datos de usuario. Riesgo bajo pero patrón peligroso.
**Fix:** Mover a archivo CSS o clase Tailwind.

---

### 🟢 BAJO — F-13: Sin MFA
**OWASP:** A07:2021

App médica sin segundo factor de autenticación.
**ACCION MANUAL:** Habilitar TOTP MFA en Supabase Dashboard → Authentication → Multi-Factor Auth.

---

### 🟢 BAJO — F-14: Link de recuperación de contraseña muerto
**OWASP:** A07:2021 | **Archivo:** `src/pages/Login.tsx`

`href="#"` — recuperación de contraseña no funcional. Usuarios bloqueados sin mecanismo de auto-recuperación.

**Fix:** Implementar `supabase.auth.resetPasswordForEmail(email)` con redirectTo.

---

### 🟢 BAJO — F-15: bulkCreateImplants sin límite de tamaño
**OWASP:** A04:2021 | **Archivo:** `src/services/implantService.ts:99-103`

Array de tamaño arbitrario puede causar carga en DB.
**Fix:** `if (implants.length > 500) throw new Error('Máximo 500 por lote');`

---

### 🔵 INFO — F-16: sendAlert envía objeto Surgery completo
**OWASP:** A04:2021 least privilege | **Archivo:** `src/services/surgeryService.ts:152-158`

Edge Function recibe más datos de paciente de los necesarios (principio de mínimo privilegio).
**Fix:** Enviar solo los campos requeridos por el Edge Function.

---

## RESUMEN EJECUTIVO

| Severidad | Cantidad | IDs |
|----------|---------|-----|
| 🔴 CRITICO | 2 | F-01, F-02 |
| 🟠 ALTO | 4 | F-03, F-04, F-05, F-06 |
| 🟡 MEDIO | 5 | F-07, F-08, F-09, F-10, F-11 |
| 🟢 BAJO | 4 | F-12, F-13, F-14, F-15 |
| 🔵 INFO | 1 | F-16 |
| **Total** | **16** | |

### Acciones Manuales (Supabase Dashboard / infraestructura)
| ID | Acción |
|----|--------|
| F-02 | Verificar RLS en TODAS las tablas de Supabase |
| F-04 | Habilitar rate limiting + CAPTCHA en Supabase Auth |
| F-07 | Configurar política de contraseñas en Supabase Auth |
| F-11 | Verificar RLS en tabla `notifications` |
| F-13 | Habilitar MFA en Supabase Auth |

---

## FASE 4 — RESULTADO

Rama `security/audit-fixes`. Commits separados por hallazgo. `tsc --noEmit`
y `npm run build` pasan. `npm audit` → 0 vulnerabilidades.

### Corregido en código
| ID | Severidad | Estado | Commit |
|----|-----------|--------|--------|
| F-01 | CRITICO | ✅ Corregido | escapeHtml en Reportes.tsx |
| F-02 | CRITICO | ✅ Corregido | URL/ref e2e desde env |
| F-03 | ALTO | ✅ Corregido | crypto.getRandomValues |
| F-04 | ALTO | ✅ Parcial | throttling cliente (server = manual) |
| F-05 | ALTO | ✅ Corregido | npm audit fix → 0 vulns |
| F-06 | ALTO | ⚠️ Riesgo aceptado | mantener xlsx 0.20.3 CDN (ver F-06) |
| F-07 | MEDIO | ✅ Parcial | política 12+ chars (Supabase = manual) |
| F-08 | MEDIO | ✅ Corregido | compare-and-swap en stock |
| F-09 | MEDIO | ✅ Corregido | allowlist hospital/surgeon |
| F-10 | MEDIO | ✅ Corregido | vercel.json security headers |
| F-11 | MEDIO | ✅ Corregido | filtro user_id en markAsRead |
| F-12 | BAJO | ✅ Corregido | CSS movido a Calendario.css |
| F-13 | BAJO | ⏳ Manual | habilitar MFA en Supabase |
| F-14 | BAJO | ✅ Corregido | resetPasswordForEmail |
| F-15 | BAJO | ✅ Corregido | límite 500 en bulkCreateImplants |
| F-16 | INFO | ✅ Corregido | payload mínimo en sendAlert |

### Acciones Manuales Pendientes (NO automatizables — requieren Dashboard Supabase)
| ID | Acción |
|----|--------|
| F-02 | Verificar RLS habilitado en TODAS las tablas |
| F-04 | Habilitar rate limiting + CAPTCHA en Supabase Auth |
| F-07 | Configurar password strength en Supabase Auth |
| F-11 | Verificar RLS en tabla `notifications`: `USING (user_id = auth.uid())` |
| F-13 | Habilitar TOTP MFA en Supabase Auth (forzar para Administrador) |
| F-06 | Monitorear avisos de seguridad de SheetJS |

### Hallazgo adicional detectado durante Fase 4
**F-17 (INFO):** El Edge Function `send-surgery-alert` interpola datos de
DB sin escapar en el HTML del email (`${surgery.patient_name}` etc.) y
usa `Access-Control-Allow-Origin: '*'`. Bajo impacto (los clientes de
correo no ejecutan JS), pero conviene escapar y restringir CORS. Requiere
editar y redesplegar el Edge Function (acción manual de infraestructura).

---

## FASE 5 — Chequeo 2026-07-12 (skill `chequeo-seguridad`, rama `feat/impersonation`)

Chequeo dirigido tras cambios acumulados desde Fase 4 (impersonation, portal
cirujano, mapa de almacén, auditoría). Metodología: `.claude/skills/chequeo-seguridad/SKILL.md`.

---

### 🔴 CRITICO — F-18: Cross-tenant account takeover en `manage-users`
**OWASP:** A01:2021 Broken Access Control | **Archivo:** `supabase/functions/manage-users/index.ts` (acciones `update`/`delete`)

Las acciones `update` y `delete` validaban solo `profile.role ∈ {Superadmin, Administrador}`,
sin comparar el `org_id` del que llama contra el `org_id` del `userId` objetivo.
Como ambas operan con la **service role** (`auth.admin.updateUserById`,
`auth.admin.deleteUser`, `profiles.delete`), bypasean RLS por completo.

**PoC:** un `Administrador` de la Org A llama la función con
`{action:'update', userId:'<uuid de un usuario de la Org B>', userData:{password:'X', role:'Superadmin'}}`
y resetea la contraseña/escala el rol de una cuenta ajena; con `action:'delete'`
puede borrarla. Sin relación con impersonation ni con ningún check de frontend.

**Fix aplicado:** `assertSameOrgAsTarget()` — exige que `targetProfile.org_id === profile.org_id`
antes de `update`/`delete`, salvo `profile.is_platform_admin === true` (mantenimiento
de plataforma). Se usa `is_platform_admin`, no `role === 'Superadmin'`, porque
`Superadmin` en este proyecto es el tope de la jerarquía **dentro** de una org
(ver `CLAUDE.md` → Roles), consistente con cómo el resto del código (`manage-orgs`,
todas las policies RLS) ya distingue "plataforma" de "rol".

**Estado:** ✅ Corregido en código y redesplegado a producción vía Supabase
Dashboard (2026-07-12).

---

### 🔴 CRITICO — F-19: Stored XSS en impresión de bandejas (regresión de F-01)
**OWASP:** A03:2021 Injection (XSS) | **Archivo:** `src/pages/Bandejas.tsx:145-198`

El fix de F-01 (`escapeHtml`) se aplicó en `Reportes.tsx` pero nunca se llevó
a `Bandejas.tsx`, que tiene el mismo patrón: `item.implant?.name`, `item.implant?.sku`,
`item.quantity`, `trayName`, `trayCode` se interpolaban sin escapar en
`win.document.write(...)`.

**PoC:** un `Editor`/`Técnico` (no solo Admin) nombra un implante o bandeja
`<img src=x onerror=alert(document.cookie)>`; el JS ejecuta en la ventana de
impresión de cualquier otro usuario de la org que imprima esa bandeja.

**Fix aplicado:** `escapeHtml()` extraída a `src/utils/escapeHtml.ts` (antes
duplicada solo en `Reportes.tsx`, ahora compartida) y aplicada a los 6 valores
interpolados en `Bandejas.tsx`. `tsc --noEmit` verificado limpio.

**Estado:** ✅ Corregido en código y build.

---

### 🟠 ALTO — A-1 (pendiente, sin ID F- porque no es un bug de código): Superadmin real committeado en git
**Archivo:** `scripts/assign_admin.js:9`

UID (`bb27f2e7-…`) y email (`admin@medops.com`) reales de una cuenta `Superadmin`
hardcodeados en un script versionado, en un repo con fork externo
(`jolumax/medops`). Combinado con F-18 (antes del fix), esto habría permitido
tomar control total de esa cuenta desde cualquier `Administrador`.

**Acción pendiente (no aplicada — requiere decisión del usuario):**
1. Eliminar o parametrizar `scripts/assign_admin.js` (nunca hardcodear UIDs/emails reales).
2. Rotar la contraseña de esa cuenta Superadmin en Supabase Dashboard, ya que su
   identidad quedó expuesta en el historial de git independientemente del fix de F-18.

---

## RESUMEN — Fase 5

| ID | Severidad | Estado |
|----|-----------|--------|
| F-18 | 🔴 CRITICO | ✅ Corregido en código y redesplegado a producción |
| F-19 | 🔴 CRITICO | ✅ Corregido en código y build |
| A-1  | 🟠 ALTO | ⏳ Pendiente — decisión del usuario |

### Descartado durante verificación (Fase 5)
- Fuga cross-org en `notify_surgery_status_change`: el hotfix suelto
  `supabase/fix_notification_trigger_org_scope.sql` ya está reflejado en el
  baseline actual (`0000_baseline_schema.sql:144-168` tiene el filtro `org_id`).
- Advisories de `npm audit` (`dompurify`, `react-router`, `ws`): ninguno alcanza
  una ruta de código realmente ejecutada por MedOps (ver detalle en el chequeo
  de sesión — `jsPDF.html()` nunca se llama, la app es SPA sin servidor de
  React Router, `ws` solo se usa como cliente saliente).

### NO revisado en Fase 5
- Matriz completa RLS (4 operaciones × ~20 tablas) — solo se verificó el patrón
  en `profiles`, `notifications`, `organizations`.
- `AlmacenMap.tsx`, `Organizaciones.tsx`, `AuditTrail.tsx`, `InventoryChat.tsx`,
  `SessionTimeoutModal.tsx` línea por línea.
- Settings de Supabase Dashboard (rate limiting, MFA, password policy — ver F-04/F-07/F-13).
- Si el webhook de Telegram tiene `secret_token` configurado.
