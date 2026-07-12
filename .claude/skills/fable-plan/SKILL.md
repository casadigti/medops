---
name: fable-plan
description: Cómo planear una función nueva o un cambio en MedOps antes de escribir código. Usar cuando el usuario pida "planea", "diseña", "cómo harías", "quiero agregar", "nueva función", "nueva página", "nuevo reporte", "nueva tabla", o describa una feature sin pedir aún la implementación. Cargar ANTES de proponer cualquier plan o tocar cualquier archivo.
---

# Planear una función en MedOps

Este es el método de planeación de Fable 5 en este proyecto, destilado de
trabajar en él. La regla madre: **un plan escrito sin haber leído el código
que va a tocar es ficción.** Primero se explora, luego se pregunta, luego
se planea. En ese orden.

MedOps es multi-tenant con datos de pacientes. Eso convierte dos preguntas
en obligatorias en TODO plan: "¿esta feature respeta el aislamiento por
org?" y "¿expone algún dato de paciente por un canal nuevo?". Si un plan no
las responde explícitamente, está incompleto.

## Fase 1 — Explorar antes de proponer

Nunca proponer nada sin leer primero, según la zona que se va a tocar:

| Si el cambio toca… | Leer PRIMERO |
|---|---|
| Cualquier cosa (siempre) | `CLAUDE.md`, `HANDOFF.md` (estado real: qué está desplegado, qué migración corrió), `.claude/napkin.md` |
| Una página existente | La página en `src/pages/`, su(s) service(s) en `src/services/`, los tipos que usa en `src/types/domain.ts` |
| Una página nueva | `src/App.tsx` (rutas + guards de rol), `src/components/layout/Sidebar.tsx` y `Layout.tsx` (los DOS navItems), una página parecida como plantilla |
| Datos / tabla nueva | `supabase/migrations/` (la migración más reciente para saber el próximo número — ojo: hay números duplicados históricos), `0002_multitenancy_rls.sql` como referencia de policies, `HANDOFF.md` § migraciones para saber qué corrió en producción |
| Un service | El service afectado + `src/lib/supabase.ts` (cliente y `restQuery`) + `src/utils/impersonation.ts` |
| Edge Functions | La función en `supabase/functions/`, el script `deploy:functions` en `package.json` (flags importan: `inventory-search` va con `--no-verify-jwt`), `SECURITY_AUDIT.md` |
| Roles / permisos | `src/App.tsx` (guards), las policies RLS en migraciones. Recordar: el check de rol en React es UI; la autorización real es RLS |
| Notificaciones / realtime | `src/services/notificationService.ts`, triggers en migraciones (`fix_notification_trigger_org_scope.sql`) |

Salida de esta fase: poder decir en qué archivos exactos va el cambio y
qué patrón existente se va a imitar. Si no se puede, seguir leyendo.

## Fase 2 — Las preguntas obligatorias

Responder por escrito, en el plan, todas:

1. **¿Cuál es el problema real detrás del pedido?** El usuario pide una
   solución; escribir el problema que la motiva. Si el problema admite una
   solución más chica que la pedida, proponerla.
2. **¿Qué es lo más pequeño que resuelve el problema?** MedOps castiga la
   sobre-ingeniería: el patrón service directo sobre supabase-js aguantó
   17+ páginas sin abstracciones. Nada de capas "por si acaso".
3. **¿Qué se rompe con este cambio AQUÍ?** Checklist específico de MedOps:
   - ¿Tabla nueva o columna nueva? → migración manual en SQL Editor (NUNCA
     `supabase db push`), con `org_id uuid NOT NULL DEFAULT get_my_org_id()`,
     RLS habilitado y policy para las 4 operaciones. Sin el default de
     org_id, el INSERT falla con 400.
   - ¿Query nueva en un service? → debe aplicar `getImpersonatedOrgId()`
     o la impersonación de Superadmin queda ciega a esos datos.
   - ¿El rol `Cirujano` ve esta pantalla/dato? Es un portal separado con
     RLS propio (migraciones 0013/0015/0016) — solo debe ver SUS filas.
   - ¿Edge Function tocada? → el código local NO es producción hasta correr
     `npm run deploy:functions`. Anotarlo como paso del plan, no asumirlo.
   - ¿HTML interpolado (impresión, email)? → todo valor pasa por
     `src/utils/escapeHtml.ts`. Este XSS ya ocurrió DOS veces aquí.
   - ¿Export CSV/Excel con texto libre? → inyección de fórmulas (`=`,`+`,`-`,`@`).
4. **¿Qué casos límite aplican?** Mínimo considerar: org sin datos (tenant
   recién creado), usuario `Lector` (solo lectura), Superadmin impersonando,
   campos opcionales nulos en tipos de `domain.ts`, y móvil (el nav de
   `Layout.tsx` es distinto al Sidebar).
5. **¿Cómo verificamos que quedó?** Con los comandos reales (ver Fase 4).
   Cada paso del plan nombra SU verificación, no una genérica al final.
6. **¿Qué NO vamos a hacer y por qué?** Lista explícita. Evita que la
   sesión siguiente "complete" alcance que se descartó a propósito.

**La regla de las preguntas:** si una pregunta al usuario puede CAMBIAR el
plan (alcance, quién lo usa, si es multi-org, si necesita migración), se
hace ANTES de escribir el plan. Si la respuesta no cambia el plan, no se
pregunta: se decide lo razonable y se anota la decisión en el plan ("Decidí
X porque Y — avisar si no era eso").

## Fase 3 — El plan: pasos chicos y reversibles

- Cada paso cabe en un commit Conventional Commits (`feat(scope):`,
  `fix(scope):`) y deja el proyecto funcionando. Nada de "paso 3: refactor
  general".
- Orden típico en MedOps: **migración → tipo en `domain.ts` → service →
  página/UI → nav (Sidebar + Layout) → tests**. La migración va primero
  porque es el único paso manual e irreversible-ish; se escribe con su
  bloque de rollback comentado.
- Cada paso lleva su verificación pegada (ver Fase 4).
- Lo visual se verifica en el navegador ANTES de commitear. Cicatriz real:
  8 commits a ciegas peleando con una barra de filtros CSS. Un vistazo por
  iteración = 1 commit.
- Los cambios de comportamiento con lógica (services) llevan test unitario
  en `src/services/__tests__/`; los flujos de usuario nuevos llevan spec en
  `e2e/` (mocks con regex routes `new RegExp('/rest/v1/tabla')`, nunca URL
  literal; selectores con `data-testid` o `.first()` para evitar
  strict-mode).

## Fase 4 — Verificación con los comandos de ESTE proyecto

| Qué | Comando | Cuándo |
|---|---|---|
| Tipos | `npx tsc --noEmit` | Antes de CADA commit (el proyecto compila limpio; mantenerlo) |
| Lint | `npm run lint` | Antes de cada commit |
| Unit | `npm run test` | Tras tocar services/utils |
| E2E | `npm run test:e2e` (o `npx playwright test e2e/<spec>.spec.ts` para uno) | Tras tocar flujos de usuario |
| Ojo humano | `npm run dev` + browser preview | Antes de commitear cualquier cambio visual |
| Migración | Ejecutar a mano en Supabase Dashboard → SQL Editor, luego actualizar la tabla de migraciones de `HANDOFF.md` | Al aplicar |
| Edge Functions | `npm run deploy:functions` | Al terminar; sin esto producción sigue con el código viejo |

Cierre de rama: push a `git push fork <rama>`, PR a `casadigti/medops`
entregado como URL plana (`https://github.com/casadigti/medops/pull/N`).

## Formato de salida del plan

```markdown
# Plan: <título corto>

**Problema real:** <una o dos frases>
**Lo mínimo que lo resuelve:** <una frase>

## Decisiones tomadas (no preguntadas porque no cambian el plan)
- <decisión>: <por qué>

## Qué NO haremos
- <cosa>: <por qué>

## Riesgos específicos aquí
- <multi-tenancy / RLS / impersonation / XSS / deploy pendiente según aplique>

## Pasos
1. <paso chico> — archivos: `<rutas>` — verifica con: `<comando o "ojo en navegador">`
2. …

## Casos límite cubiertos
- <lista>
```

Si al explorar aparece algo que contradice el pedido (la feature ya existe
a medias, o el dato que se quiere mostrar no está en el esquema), se
reporta ANTES de planear encima.
