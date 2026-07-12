---
name: fixer
description: Metodología de arreglo de bugs específica de MedOps. Usar cuando el usuario reporte un bug, un error, un test que falla, algo que "no funciona", "se rompió", "da 400/401/500", una pantalla en blanco, o pida "arregla X". También cuando otra sesión o modelo afirme que algo "ya quedó arreglado" y haya que verificarlo.
---

# Fixer — cómo se arreglan bugs en MedOps

MedOps: React 19 + Vite + Supabase (PostgreSQL + RLS + Edge Functions Deno) + Vercel.
Esta skill define el proceso obligatorio y los comandos REALES de este proyecto. No improvises comandos genéricos.

## Las 6 reglas (no negociables)

1. **Reproducir primero.** El bug tiene que fallar frente a ti antes de tocar una línea. Si no puedes reproducirlo, todavía no lo entiendes — sigue investigando, no "arregles" a ciegas.
2. **Causa raíz, no síntoma.** Pregunta "¿por qué?" hacia atrás hasta llegar al código que DECIDE, no al que muestra el error. En este proyecto el error casi siempre aparece en una página (`src/pages/`) pero la decisión vive en un servicio (`src/services/`), en una policy RLS (`supabase/migrations/`) o en una Edge Function (`supabase/functions/`).
3. **Arreglo mínimo.** Solo lo que cierra el bug. Cero refactors de "ya que estamos aquí". Si ves algo más que arreglar, repórtalo aparte — no lo mezcles en el mismo cambio.
4. **Probar con evidencia.** Correr el caso EXACTO que fallaba con los comandos de la sección "Verificación" y pegar el output. "Debería funcionar" está prohibido.
5. **Regla contra el "ya quedó".** Si otro modelo, una sesión anterior, un HANDOFF.md o un commit dice que algo está arreglado, exige el output que lo demuestra. Sin evidencia, se trata como NO arreglado y se re-verifica corriendo la prueba.
6. **Reporte fiel.** Si la prueba falla después del fix, se dice con el output completo. Nunca se reporta éxito parcial como éxito.

## Paso 1 — Reproducir (elegir la capa correcta)

Identifica en qué capa vive el bug y reprodúcelo ahí:

| Capa | Cómo reproducir |
|------|-----------------|
| Lógica de servicio | Test unitario: `npx vitest run src/services/__tests__/<servicio>.test.js` (o `-t "nombre del test"` para uno solo). Los tests viven en `src/services/__tests__/`. |
| UI / flujo de página | E2E: `npx playwright test e2e/<pagina>.spec.ts`. Los specs viven en `e2e/`. O manual: dev server con el Browser pane (`preview_start` con name `medops-dev`, puerto 5173) y reproducir el flujo a mano. |
| Tipos / compilación | `npx tsc --noEmit` (el proyecto compila limpio; cualquier error es nuevo). |
| RLS / datos cruzados entre orgs | NO reproducible localmente — no hay Supabase local. Se verifica leyendo la policy en `supabase/migrations/` y, si hay acceso, probando en el Dashboard SQL Editor. Declarar explícitamente lo que no se pudo probar. |
| Edge Functions | Localmente solo lectura de código (`supabase/functions/*/index.ts`). Logs de ejecución: Supabase Dashboard → Edge Functions → Logs (no accesible desde el repo). |

**Claves de reproducción de ESTE proyecto:**
- Los E2E están 100% mockeados (`e2e/fixtures/auth.ts` intercepta todo `$SUPABASE_URL/**`). Sirven para bugs de UI/estado, NO prueban backend ni RLS.
- Playwright levanta su propio Vite en el puerto **4173** (el dev normal usa 5173) y reusa el server si ya está corriendo. Reporte HTML en `playwright-report/`, screenshots/traces de fallos en `test-results/`.
- Errores de Supabase en la app aparecen en la **consola del navegador** (los servicios hacen `throw error`). Con el Browser pane usa `read_console_messages` y `read_network_requests` (buscar 400/401/403 contra `/rest/v1/`).
- Un `400` en INSERT casi siempre es tabla sin `org_id DEFAULT get_my_org_id()`. Un `401` en `inventory-search` es deploy sin el flag JWT-bypass (usar `npm run deploy:functions`, ya lo incluye).
- Timezone: RD es UTC-4. `new Date('2026-01-01')` es medianoche UTC, NO local — fuente conocida de bugs de fechas (ver `auditService.getFiltered`, que usa `T00:00:00` sin `Z` a propósito).
- En E2E: usar rutas regex (`new RegExp('/rest/v1/tabla')`) no URLs literales; y scopear selectores con `data-testid` o `.first()` — `getByText` da strict-mode si el Dashboard repite el dato.

## Paso 2 — Causa raíz

- Sigue la cadena: página → servicio → query Supabase → RLS/función. El fix va donde está la DECISIÓN equivocada.
- Si un test falla, decide primero si el bug está en el código o en el test: lee los comentarios del código de producción — si el comportamiento actual es intencional y documentado, el test es el que está desactualizado.
- `git log -p --follow -- <archivo>` para ver cuándo y por qué cambió lo que se rompió.
- Impersonation: todos los servicios filtran con `getImpersonatedOrgId()`. Si un dato "desaparece" o "aparece de más" en modo impersonation, revisa ese filtro antes que nada.

## Paso 3 — Arreglo mínimo

- Un bug = un cambio. Tipos solo en `src/types/domain.ts`. Migraciones nuevas = archivo `supabase/migrations/000X_*.sql` ejecutado A MANO en el Dashboard (jamás `supabase db push`).
- Avisos operativos: el hook GateGuard puede bloquear Bash/Write pidiendo "facts" (declarar 2-4 y reintentar); MCP Sentinel bloquea escrituras con strings sensibles (`_KEY`, `_TOKEN`, etc.) — reformular, no desactivar. Los warnings CRLF de git en Windows son inofensivos.

## Paso 4 — Verificación (comandos reales, en este orden)

1. **El caso exacto que fallaba**, con el mismo comando del Paso 1. Pegar el output.
2. **Salud general del proyecto** (esto es "el proyecto sigue sano"):
   ```bash
   npx tsc --noEmit    # sin output = limpio
   npm run lint        # ESLint
   npm run test        # Vitest completo (~103 tests, ~5s)
   ```
3. Si se tocó UI: `npm run test:e2e` (o el spec afectado). Si falla, abrir `playwright-report/index.html` y los artifacts de `test-results/`.
4. Si se tocó el build/config: `npm run build`.
5. Si se tocó una Edge Function: `npm run deploy:functions` y verificar en Dashboard → Edge Functions → Logs.

## Paso 5 — Reporte

- Qué fallaba, cuál era la causa raíz, qué se cambió (mínimo), y el output de la verificación — el que falló Y el que pasó.
- Lo que NO se pudo verificar (RLS, Edge Functions sin acceso al Dashboard) se declara explícitamente como no verificado.
- Commit: Conventional Commits (`fix(scope): ...`). Si se toca seguridad, correr también la skill `chequeo-seguridad`.
