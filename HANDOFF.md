# MedOps — Handoff Document
**Fecha:** 2026-07-12 | **Rama activa:** `feat/impersonation` (mergeada a `main` vía PR #82, en Production) | **Último PR:** #82

---

## Stack

React 19.2.5 + Vite 8 + TypeScript 6 + Tailwind 4 + Supabase JS 2 + React Router 7 + Zustand 5 + Vercel

---

## Páginas (src/pages/)

| Página | Función |
|--------|---------|
| `Dashboard.tsx` | KPIs + charts (cirugías mensuales, stock) |
| `Cirugias.tsx` | CRUD cirugías, consumo implantes/lotes, PDF acta, 12 estados |
| `Bandejas.tsx` | Inventario bandejas, esterilización, mantenimiento, ubicación |
| `InventarioQuirurgico.tsx` | Implantes + lotes, alertas expiración, import/export Excel |
| `Calendario.tsx` | Vista FullCalendar de cirugías por fecha/cirujano |
| `Mantenimiento.tsx` | Log mantenimiento bandejas (limpieza, reparación) |
| `Directorio.tsx` | Directorio cirujanos y hospitales, historial por cirujano |
| `Reportes.tsx` | Analytics multi-vista: cirujano/hospital/ARS + charts |
| `ReporteLotes.tsx` | Tracking expiración lotes, alertas, export Excel |
| `ReporteReposicion.tsx` | Reporte consumo por material/cirugía, snapshot stock |
| `Configuracion.tsx` | Settings org: identidad, ARS, tipos procedimiento, usuarios, backup |
| `Organizaciones.tsx` | Admin multi-tenant: crear/desactivar orgs, impersonación |
| `MisSolicitudes.tsx` | Portal cirujano: crea solicitudes de cirugía + historial con estado (Pendiente/Aprobada/Rechazada) |
| `AlmacenMap.tsx` | Mapa visual almacén: floor plan 2D drag-and-drop, facing 4 estados, objetos de sala, tarjetas adaptativas. Al asignar bandeja a celda → auto-actualiza `trays.location` |
| `PreparacionBandeja.tsx` | Panel técnico `/preparacion`: KPIs, alertas, cambio de estado inline, realtime |
| `AuditTrail.tsx` | `/auditoria`: log auditoría paginado, filtros (fecha/acción/entidad), export XLSX. Admin-only |
| `Login.tsx` | Auth con throttle 5 intentos (localStorage `medops_login_throttle`), force-change-password |

---

## Servicios (src/services/)

`surgeryService` · `surgeryRequestService` · `surgeonService` · `hospitalService` · `trayService` · `implantService` · `arsService` · `procedureTypeService` · `organizationService` · `configService` · `notificationService` · `auditService` · `backupService` · `printService` · `storageService` · `roomObjectService`

`surgeryRequestService`: portal cirujano. `create`/`getPending`/`getMySurgeonRequests`/`approve` (crea cirugía real + link) / `reject` (motivo).

Patrón: todos aplican `getImpersonatedOrgId()` para multi-tenancy.

---

## Edge Functions (supabase/functions/)

| Función | Propósito |
|---------|-----------|
| `inventory-search` | Bot Telegram: voz→texto (Groq Whisper) + búsqueda inventario. Deploy con `--no-verify-jwt` |
| `manage-orgs` | Crear/eliminar org + auto-seed ARS & procedure_types de org del platform admin |
| `manage-users` | Crear usuarios con rol, reset password, asignar org. Reset → `email_confirm=true` (evita "Waiting for verification" que bloquea login) + error honesto si perfil sin auth user. `update`/`delete` ahora exigen misma org que el caller salvo `is_platform_admin` (fix F-18, 2026-07-12). **Redeploy pendiente** — código local no reflejado en producción todavía. |
| `send-surgery-alert` | Notificaciones push en cambios de estado de cirugía |

---

## Migraciones ejecutadas en producción

| Archivo | Estado |
|---------|--------|
| `0000_baseline_schema.sql` | ✅ |
| `0001_multitenancy_schema.sql` | ✅ |
| `0001_add_telegram_chat_id.sql` | ✅ |
| `0002_multitenancy_rls.sql` | ✅ |
| `0003_storage_map.sql` | ✅ |
| `0004_telegram_rpc_storage_location.sql` | ✅ |
| `0005_fix_ars_procedure_types_unique_constraint.sql` | ✅ |
| `0006_trays_unique_constraint_per_org.sql` | ✅ |
| `0007_floorplan.sql` | ✅ |
| `0008_shelf_facing.sql` | ✅ |
| `0009_room_objects.sql` | ✅ |
| `0010_tray_items.sql` | ✅ |
| `0011_performance_indexes.sql` | ✅ |
| `0012_surgery_requests.sql` | ✅ (2026-06-06) tabla solicitudes cirujano + RLS |
| `fix_notification_trigger_org_scope.sql` | ✅ |
| `ALTER storage_shelves org_id default` | ✅ |

---

## IDs de producción

| Entidad | ID |
|---------|----|
| Organización Principal | `12799f3f-1ab9-4a78-accf-9d88d6a58679` |
| Ortho-Bone Dominicana | `806c8399-5ef2-483a-89a0-aef63697de57` |
| Supabase project ref | `rlygbfossyzqljdtlvfk` |

---

## Pendientes

**Seguridad (ver `SECURITY_AUDIT.md` Fase 5, 2026-07-12) — ALTA prioridad:**
- **F-18 (cross-tenant account takeover en `manage-users`)** — corregido en
  código y **redesplegado a producción** vía Supabase Dashboard (2026-07-12).
- **F-19 (Stored XSS en `Bandejas.tsx`)** — corregido en código, se despliega
  con el build normal de frontend (Vercel), sin acción extra.
- **A-1 pendiente de decisión:** `scripts/assign_admin.js` tiene un UID/email
  reales de una cuenta Superadmin hardcodeados en git. Decidir: eliminar el
  script vs. parametrizarlo, y rotar la contraseña de esa cuenta en Supabase
  Dashboard (su identidad ya quedó expuesta en el historial independientemente
  del fix de F-18).

**Merge:** PR #82 (`feat/impersonation` → `main`) mergeado y en Production (`ad29db1`).
**Media prioridad:**
- Búsqueda global no resalta/filtra resultado específico al navegar
- CLI Supabase 403 al deploy (cuenta sin privilegios) → deploys via Dashboard o `supabase login`
**Baja prioridad:**
- Security scan: Grado B (89/100) — denyList en `.claude/settings.json`

**Ideas roadmap (sin empezar):** checklist esterilización · alertas mantenimiento preventivo · comentarios por cirugía · costo real por cirugía · módulo proveedores/OC (solo proveedores + OC como documento generado; ver veredicto abogado-del-diablo 2026-07-12) · preferencias implantes por cirujano.
**Descartado (2026-07-12):** facturación — se hace en Odoo. Como mucho, exports que alimenten Odoo.

---

## Trabajo sesión 2026-07-12 — chequeo de seguridad + fixes F-18/F-19

Ejecutada la skill `.claude/skills/chequeo-seguridad/SKILL.md` (creada esta
misma sesión) sobre `feat/impersonation`. Detalle completo en
`SECURITY_AUDIT.md` → Fase 5.

| Hallazgo | Severidad | Fix |
|----------|-----------|-----|
| F-18: `manage-users` `update`/`delete` sin check de org cruzada | 🔴 Crítico | `assertSameOrgAsTarget()` en `supabase/functions/manage-users/index.ts` — bypass solo para `is_platform_admin`, no para `role==='Superadmin'`. Redesplegado a producción 2026-07-12. |
| F-19: XSS sin escapar en impresión de bandejas (regresión de F-01) | 🔴 Crítico | `escapeHtml()` extraída a `src/utils/escapeHtml.ts` (compartida con `Reportes.tsx`), aplicada en `src/pages/Bandejas.tsx`. `tsc --noEmit` limpio. |
| A-1: Superadmin real hardcodeado en `scripts/assign_admin.js` | 🟠 Alto | Sin resolver — pendiente decisión de usuario. |

**Aclaración de roles capturada esta sesión:** `is_platform_admin` (boolean)
es la bandera real de acceso multi-organización/modo mantenimiento. El texto
del rol `Superadmin` es el tope de la jerarquía **dentro** de una org, no
implica acceso a otras orgs por sí solo — así lo trata el resto del código
(`manage-orgs`, todas las policies RLS) y así se corrigió `manage-users`.

**Skill nueva:** `.claude/skills/chequeo-seguridad/SKILL.md` — chequeo de
seguridad específico de MedOps (secretos → validación de entrada → multi-tenancy
→ inyección/XSS → logs sensibles → dependencias), con archivos/líneas reales
del proyecto. Invocar con `/chequeo-seguridad`.

**Merge con el fork:** `fork/feat/impersonation` (jolumax) tenía un commit
(`99ca0e6`) no presente en local: fix RLS de `surgery_requests` (fuga cross-org
de PHI, migración `0019_fix_surgery_requests_rls.sql`), el mismo fix de XSS en
`Bandejas.tsx` hecho de forma independiente (inline), quitado el email
hardcodeado de fallback en `send-surgery-alert`, y bump de `react-router` por
CVE. Se mergeó con `git merge fork/feat/impersonation`; el único conflicto real
(`escapeHtml` duplicado en `Bandejas.tsx`, definido inline por el fork Y
importado del util compartido por esta sesión) se resolvió a favor del util
compartido (`0986548`).

**Errores de consola en preview (Vercel Deployment Protection):**
| Error | Causa | Fix |
|-------|-------|-----|
| CSP `violates ... default-src 'self'` para `vercel.com`/`vercel.live` | El toolbar/feedback de preview de Vercel no estaba en la allowlist del CSP de `vercel.json` | `vercel.com`/`vercel.live` añadidos solo a `script-src`, `connect-src`, `img-src`, `manifest-src`, nuevo `frame-src` (`27db462`) |
| `CORS ... No Access-Control-Allow-Origin` + `307` en `manifest.webmanifest` | `vite-plugin-pwa` inyecta el `<link rel="manifest">` sin `crossorigin`; sin cookie, Vercel SSO gate lo redirige y el fetch cross-origin falla CORS | `useCredentials: true` en `VitePWA()` (`vite.config.js`) → inyecta `crossorigin="use-credentials"` (`1079caf`) |

Ambos solo afectan previews protegidos por SSO; producción no tiene ese gate.

**Skill nueva:** `.claude/skills/fixer/SKILL.md` — metodología de arreglo de
bugs específica de MedOps (reproducir → causa raíz → arreglo mínimo → probar
con evidencia → contra el "ya quedó" → reporte fiel), con los comandos reales
del proyecto (`npx vitest run ... -t "..."`, `npx playwright test e2e/...`,
`npx tsc --noEmit`). Invocar con `/fixer`. Además, skill global (no versionada
en este repo) `~/.claude/skills/fable-fixer/SKILL.md` con la misma filosofía,
reusable en cualquier proyecto.

**Demostrada la skill fixer en esta sesión:** test `auditService.getFiltered
> applies gte filter for dateFrom` fallaba por expectativa UTC desactualizada
(el servicio parsea fechas en local time a propósito, RD/UTC-4); corregido en
`src/services/__tests__/auditService.test.js` (`aaea08c`).

---

## Trabajo sesión 2026-06-06 — PRs #66–#70 + deploy manage-users

| PR / commit | Detalle |
|-------------|---------|
| #66 | Bandejas: botón "Imprimir hoja" — checklist componentes + firma |
| #67 | Almacén: al asignar/liberar bandeja en celda → auto-sync `trays.location` (`storageService.assignSlot/clearSlot`) |
| #68 | **Portal solicitudes cirugía**: tabla `surgery_requests` (mig 0012) + `surgeryRequestService`. Cirujano crea solicitud; admin Aprueba (crea cirugía)/Rechaza (motivo) desde panel ámbar en `Cirugias.tsx` |
| #69 | `configService.updateUser`: lee `error.context.json()` para mostrar error real (antes "non-2xx status code" genérico) |
| #70 | Configuración: validación `minLength=8` + contador en reset contraseña; fix placeholder en `e2e/password-reset.spec.ts` |
| deploy | `manage-users`: `email_confirm=true` en reset + no tragar "not found". **Desplegado via Dashboard** (CLI dio 403) |

**Bug login resuelto:** usuarios "Waiting for verification" (email sin confirmar) no podían entrar aunque la contraseña fuera correcta. Reset desde Configuración ahora confirma el email. Limpiar bloqueo cliente: `localStorage.removeItem('medops_login_throttle')`.

**Analytics movido:** charts ARS agregados a `Reportes.tsx` (no Dashboard). Logs duplicados eliminados de `Configuracion.tsx` (vive en `AuditTrail.tsx`).
**Sort cirugías:** `surgeryService.getAll` ahora descendente (más reciente primero).

---

## Performance aplicado (2026-06-05) — PR #57

| Cambio | Detalle |
|--------|---------|
| `configService` TTL cache | 5 min, keyed por org. `getSettings`/`getRoomConfig` no hacen query en cada mount. Invalidado en writes. |
| `surgeryService.getAll()` | Acepta `{ limit?, fromDate? }` — backward-compatible. Úsalo en vistas que no necesitan toda la historia. |
| `printService` async | Ambos métodos retornan `Promise<void>` + `setTimeout(0)`. Callers pueden `await` y mostrar spinner. |
| Migration `0011` | Índices: `surgeries(org_id,surgery_date)`, `surgery_date`, `surgeon_id`, `status`; join indexes en `surgery_trays`/`surgery_consumption`; `implant_lots.expiry_date`; `audit_logs.created_at`; `notifications.is_read` |
| `Cirugias.tsx` print btn | Spinner `Loader2` mientras genera PDF, botón deshabilitado durante generación. |
| `ReporteReposicion.tsx` PDF btn | "Generando..." con spinner, `disabled` durante generación. |

---

## Refactors aplicados (2026-06-03) — PR #56

| Cambio | Detalle |
|--------|---------|
| `NavItem` unificado | Movido a `domain.ts`; eliminado de `Layout.tsx` y `Sidebar.tsx`. Usar versión de Sidebar (incluye `showStockAlert`, `isPreview`, `platformOnly`) |
| `Toast` ErrorBoundary | `ToastErrorBoundary` rodea el contenedor — crash en render no tumba la app |
| `Toast` useMemo | Métodos `.success/.error/.warning/.info` dentro de `useMemo`, no mutados en cada render |

---

## Notas operativas

| Tema | Detalle |
|------|---------|
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Tests | `npm run test` (Vitest) · `npm run test:e2e` (Playwright) |
| Deploy functions | `npm run deploy:functions` — incluye `--no-verify-jwt` |
| Migraciones | SQL manual en Supabase Dashboard → SQL Editor. NO `supabase db push` |
| Push | `git push fork feat/impersonation` |
| PR | `gh pr create --base main --head jolumax:feat/impersonation` → URL plana |
| Secrets Edge Fn | `TELEGRAM_BOT_TOKEN`, `GROQ_API_KEY` en Supabase Dashboard |
| Webhook Telegram | `https://rlygbfossyzqljdtlvfk.supabase.co/functions/v1/inventory-search/telegram` |

---

## Roles

`Superadmin` > `Administrador` > `Editor` > `Técnico` > `Lector` | `Cirujano` (portal separado)

Admin check: `userProfile?.role === 'Administrador' || userProfile?.role === 'Superadmin'`

---

## Hooks activos (ECC plugin)

- **GateGuard**: pide "facts" antes de cada Bash/Write. Desactivar: `ECC_GATEGUARD=off`
- **MCP Sentinel**: bloquea patterns peligrosos en strings
- **Caveman mode**: activo por defecto en todas las sesiones

---

## Skills instaladas

`caveman` · `superpowers` · `agent-browser` · `ui-ux-pro-max` · `ecc` · `napkin` · `graphify` · `chequeo-seguridad` (propia del proyecto) · `fixer` (propia del proyecto, `/fixer`) · `fable-fixer` (global, `~/.claude/skills/`, misma metodología reusable en cualquier proyecto)
