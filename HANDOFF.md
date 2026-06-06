# MedOps — Handoff Document
**Fecha:** 2026-06-05 | **Rama activa:** `feat/impersonation` | **Último PR:** #57 (en producción)

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
| `MisSolicitudes.tsx` | Portal cirujano: ver propias cirugías (read-only) |
| `AlmacenMap.tsx` | Mapa visual almacén: floor plan 2D drag-and-drop, facing 4 estados, objetos de sala, tarjetas adaptativas |
| `Login.tsx` | Auth con throttle 5 intentos, force-change-password |

---

## Servicios (src/services/)

`surgeryService` · `surgeonService` · `hospitalService` · `trayService` · `implantService` · `arsService` · `procedureTypeService` · `organizationService` · `configService` · `notificationService` · `auditService` · `backupService` · `printService` · `storageService` · `roomObjectService`

Patrón: todos aplican `getImpersonatedOrgId()` para multi-tenancy.

---

## Edge Functions (supabase/functions/)

| Función | Propósito |
|---------|-----------|
| `inventory-search` | Bot Telegram: voz→texto (Groq Whisper) + búsqueda inventario. Deploy con `--no-verify-jwt` |
| `manage-orgs` | Crear/eliminar org + auto-seed ARS & procedure_types de org del platform admin |
| `manage-users` | Crear usuarios con rol, reset password, asignar org |
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

**Media prioridad:**
- Búsqueda global no resalta/filtra resultado específico al navegar
**Baja prioridad:**
- Security scan: Grado B (89/100) — denyList en `.claude/settings.json`

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

`caveman` · `superpowers` · `agent-browser` · `ui-ux-pro-max` · `ecc` · `napkin` · `graphify`
