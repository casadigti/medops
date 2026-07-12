---
name: chequeo-seguridad
description: Chequeo de seguridad específico de MedOps. Usar cuando el usuario pida "chequeo de seguridad", "auditoría de seguridad", "revisa la seguridad", antes de un merge/release, o después de tocar RLS (supabase/migrations/), Edge Functions (supabase/functions/), servicios (src/services/), formularios nuevos, o el flujo de impersonation.
---

# Chequeo de seguridad — MedOps

MedOps es un SaaS multi-tenant de logística quirúrgica (React 19 + Vite + Supabase + Vercel).
**Maneja datos de pacientes** (nombres, ARS, NSS en `surgery_requests`) — cualquier fuga cruzada entre organizaciones o hacia canales externos (Telegram, email) es automáticamente severidad alta.

> Nota operativa: el hook MCP Sentinel de este repo bloquea greps/escrituras que contengan nombres de variables sensibles (los que terminan en `_KEY`, `_TOKEN`, `_SECRET`, `_PASSWORD`, más una lista fija). Si un comando tuyo es bloqueado, reformula el patrón — por ejemplo busca la subcadena `SERVICE_ROLE` en vez del nombre completo de la variable de service role. No desactives el hook.

## Contexto crítico de ESTE proyecto (leer antes de buscar nada)

1. **La autorización real vive en RLS, no en el frontend.** Los checks de rol en React (`userProfile?.role === 'Administrador'`) son solo UI. Si una policy en `supabase/migrations/` está mal, el frontend no salva nada: cualquier usuario con el anon key puede hablar directo con `/rest/v1/*`.
2. **Impersonation es client-side.** `src/utils/impersonation.ts` guarda el org en localStorage y los servicios lo usan como *filtro* (`getImpersonatedOrgId()`). La seguridad NO depende de eso: depende de que RLS permita cross-org solo a `is_platform_admin()`. Verificar siempre que un usuario normal que manipule su localStorage siga bloqueado por RLS.
3. **`inventory-search` se despliega SIN verificación JWT** (flag `--no-verify-jwt`, ver `package.json` → script `deploy:functions`). Es el webhook de Telegram. Su única "autenticación" es el `chat_id` que llega en el body → RPC `search_inventory_for_telegram` (SECURITY DEFINER, `supabase/migrations/0001_add_telegram_chat_id.sql`). Un `chat_id` es adivinable/spoofeable: cualquiera que conozca la URL de la función puede POSTear un update falso de Telegram. Verificar si se valida el header secreto de Telegram (`X-Telegram-Bot-Api-Secret-Token`); a la fecha de creación de esta skill (2026-07-12), NO se valida.
4. **`manage-users` y `manage-orgs` usan la service role de Supabase** (bypass total de RLS). Después del check de JWT, verificar que CADA acción del `switch` valide rol Y org antes de tocar datos. La acción `change-own-password` en `manage-users` intencionalmente no exige admin (el propio usuario cambia su contraseña temporal).
5. **Ya existe una auditoría previa:** `SECURITY_AUDIT.md` (2026-05-21, hallazgos F-01…F-16, + F-17 en código). Leerla PRIMERO. No redescubrir: verificar qué sigue arreglado (buscar comentarios `SECURITY F-XX` en el código) y qué regresó.

## Orden del chequeo

### Paso 0 — Estado previo
- Leer `SECURITY_AUDIT.md` completo.
- `git log --oneline -20` y `git diff main...HEAD --stat` para saber qué cambió desde la última auditoría.

### Paso 1 — Secretos expuestos o committeados
- `.env.local` existe y está gitignorado; confirmar que nunca entró al historial:
  ```bash
  git log --all --oneline -- .env .env.local
  git log -p --all -S "eyJ" -- "*.ts" "*.tsx" "*.js" "*.sql" | head -50   # los JWT de Supabase empiezan con eyJ
  ```
- Grep en el working tree por llaves reales (el anon key es público por diseño; la service role NO):
  ```bash
  grep -rn "service_role\|sbp_\|SERVICE_ROLE" src/ scripts/ e2e/ *.sql
  ```
- Revisar los SQL sueltos en la raíz (`seed_data.sql`, `setup_profiles.sql`, `link_surgeon_to_user.sql`, `apply_rls.sql`) y `scripts/assign_admin.js`: contienen UIDs y emails reales (ej. el UID de Superadmin hardcodeado en `assign_admin.js`). Datos reales committeados = hallazgo.
- Revisar `supabase/.temp/` (contiene `project-ref`, `pooler-url`) y `playwright-report/`, `test-results/` — no deben commitearse.
- Secretos que viven SOLO en Supabase Dashboard (no auditables desde el repo): el bot token de Telegram, la API key de Groq, la de Resend y la service role. Declararlos en "NO revisado" salvo que el usuario dé acceso al dashboard.

### Paso 2 — Validación de lo que entra
Superficies de entrada, en orden de riesgo:
1. `supabase/functions/inventory-search/index.ts` — body de Telegram sin autenticar (ver contexto #3). Además interpola el query del usuario en filtros PostgREST: `.or(\`name.ilike.%${q}%\`)` (líneas ~216-221). Comas y paréntesis en `q` inyectan operadores de filtro PostgREST (no es SQL injection, pero permite alterar el filtro).
2. `src/components/layout/GlobalSearch.tsx:40-43` — misma interpolación `.or(...ilike.${p})` con input del usuario.
3. `supabase/functions/manage-users/index.ts` y `manage-orgs/index.ts` — validar que `action`, `userData`, `userId` se validen contra whitelist antes de usarse con el cliente admin.
4. Formularios React (react-hook-form + Zod): verificar que toda página con formulario tenga schema Zod (`src/pages/Cirugias.tsx`, `MisSolicitudes.tsx`, `SolicitudesAdmin.tsx`, `Configuracion.tsx`…). Zod aquí es UX, no seguridad — la validación que cuenta son los CHECK constraints y las policies en las migraciones.
5. `restQuery()` en `src/lib/supabase.ts:22` — construye URLs `/rest/v1/` por concatenación; buscar callers que le pasen input del usuario sin `encodeURIComponent`.

### Paso 3 — Quién puede tocar qué dato (multi-tenancy + roles)
Es LA revisión central de este proyecto:
- Por cada tabla en `supabase/migrations/`, confirmar: (a) tiene `org_id NOT NULL DEFAULT get_my_org_id()`, (b) tiene RLS habilitado, (c) las 4 operaciones (SELECT/INSERT/UPDATE/DELETE) tienen policy y usan `get_my_org_id()` / `get_my_role()` / `is_platform_admin()`. Una tabla con RLS habilitado pero sin policy de UPDATE no queda segura por accidente — documentar la intención.
  ```bash
  grep -L "ENABLE ROW LEVEL SECURITY" supabase/migrations/*.sql
  grep -n "CREATE POLICY" supabase/migrations/*.sql
  ```
- Cada función `SECURITY DEFINER` (hay varias en `0000_baseline_schema.sql`, `0001_add_telegram_chat_id.sql`, `0017`, `0018`): ¿filtra por org? ¿quién puede ejecutarla (`GRANT EXECUTE`)? Una SECURITY DEFINER sin filtro de org es un túnel que cruza RLS.
- Rol `Cirujano` (portal separado): las migraciones `0013`, `0015`, `0016` le abren lecturas. Verificar que solo lea SUS filas (`0016_surgeon_read_own_row.sql`) y no las de otros cirujanos de la misma org.
- Test mental de impersonation: usuario rol `Lector` pone en su localStorage el org_id de otra organización → ¿qué devuelve `GET /rest/v1/implants?org_id=eq.<otro>`? Debe ser vacío por RLS. Si hay duda, escribir un test e2e en `e2e/`.

### Paso 4 — Inyección y XSS
- Plantillas de impresión con `document.write`: `src/pages/Reportes.tsx:686` y `src/pages/Bandejas.tsx:155`. F-01 se arregló con escaping en Reportes (comentario en la línea 21) — verificar que TODO valor interpolado en AMBAS plantillas pase por el escape, incluidos campos añadidos después del fix.
- `supabase/functions/send-surgery-alert/index.ts` tiene `escapeHtml()` (F-17) — verificar que se aplique a cada campo del email, no solo a algunos.
- Buscar regresiones: `grep -rn "dangerouslySetInnerHTML\|innerHTML\|document.write" src/`.
- PDFs (jsPDF en `src/services/printService.ts`) y Excel (`xlsx`): texto plano, riesgo bajo, pero si se exporta CSV/Excel verificar inyección de fórmulas en campos que empiezan con `=`, `+`, `-`, `@`.

### Paso 5 — Datos sensibles en logs, respuestas y canales externos
- `console.log`/`console.error` en `src/services/` y `src/pages/` (~36 al crear esta skill): ninguno debe imprimir datos de paciente, tokens o emails. Los `console.log` de `inventory-search` van a los logs de Supabase — verificar que no logueen datos con contexto de paciente.
- Mensajes de Telegram (`tgSend`) y emails (Resend): salen del perímetro. Verificar qué campos de paciente viajan ahí y si es lo mínimo necesario.
- Respuestas de Edge Functions en el `catch`: no devolver `error.message` crudo de Postgres (filtra nombres de tablas/policies).

### Paso 6 — Dependencias
```bash
npm audit --omit=dev
```
- Atención especial: `xlsx` se instala desde tarball de CDN (`cdn.sheetjs.com/xlsx-0.20.3`) — `npm audit` NO lo cubre; verificar manualmente contra los advisories de SheetJS (prototype pollution / ReDoS en versiones < 0.20.2).
- Las Edge Functions importan de `esm.sh` y `deno.land` con versión flotante (`@supabase/supabase-js@2`) — anotar como riesgo de supply chain.

## Regla de oro

**Cada hallazgo lleva: archivo:línea, severidad (Crítico/Alto/Medio/Bajo) y cómo se explota en UNA frase.** Si no puedes decir cómo se explota, es opinión, no hallazgo — va en una sección aparte de "observaciones" o no va.

## Antes de reportar: intentar tumbar cada hallazgo

Por cada candidato, buscar activamente la razón por la que NO es explotable:
- ¿Hay una policy RLS que ya lo bloquea aunque el código cliente parezca inseguro?
- ¿El "secreto" es el anon key (público por diseño)?
- ¿El input ya pasó por Zod + un CHECK constraint en la migración?
- ¿Ya está en `SECURITY_AUDIT.md` como arreglado, con el fix visible en el código?

Solo sobreviven los que resisten. Los descartados se mencionan en una línea ("descartado porque…") para que la próxima auditoría no repita el trabajo.

## Formato de salida

```markdown
# Chequeo de seguridad — <fecha> — rama <branch>

## Críticos
### C-1: <título> — <archivo:línea>
- Explotación: <una frase>
- Arreglo concreto: <diff o instrucción exacta, ej. "añadir policy X en migración 00XX">

## Altos / Medios / Bajos
(mismo formato)

## Descartados durante verificación
- <candidato>: descartado porque <razón>

## NO revisado (honesto)
- Secretos y settings del Supabase Dashboard (rate limiting, MFA, longitud de contraseña, secrets de Edge Functions)
- Configuración de Vercel (headers, env vars)
- <lo que haya quedado fuera esta vez>
```

Si hay hallazgos Críticos o Altos nuevos, actualizar también `SECURITY_AUDIT.md` con numeración F-XX continuando la existente.

## Lo que NUNCA se puede auditar desde este repo (preguntar al usuario)
- Settings de Auth en Supabase Dashboard: contraseña mínima (era 6 caracteres), MFA (no había), rate limiting de login (no había).
- Si el webhook de Telegram fue registrado con un secret token (se configura al llamar `setWebhook`, no aparece en el repo).
- Valores reales de los secrets de las Edge Functions y quién tiene acceso al Dashboard.
