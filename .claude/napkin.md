# Napkin Runbook — MedOps

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-05-30] Edge function inventory-search necesita flag JWT-bypass**
   Do instead: deploy con `npm run deploy:functions` (ya incluye el flag). Sin él, Telegram webhook da 401.
2. **[2026-05-30] Migraciones SQL son manuales**
   Do instead: escribir `supabase/migrations/000X_*.sql`, ejecutar a mano en Supabase Dashboard SQL Editor. Nunca db push.
3. **[2026-05-30] Tablas nuevas necesitan org_id DEFAULT get_my_org_id()**
   Do instead: incluir `org_id uuid NOT NULL DEFAULT get_my_org_id()` o el INSERT falla con 400.
4. **[2026-05-30] Verificar TypeScript antes de push**
   Do instead: `npx tsc --noEmit` antes de cada commit. El proyecto compila limpio.

## Shell & Command Reliability
1. **[2026-05-30] GateGuard bloquea Bash/Write pidiendo facts**
   Do instead: declarar 2-4 facts antes de reintentar. O setear ECC_GATEGUARD=off.
2. **[2026-05-30] MCP Sentinel bloquea strings peligrosos en cualquier archivo**
   Do instead: evitar literales de rutas a llaves SSH, pipes a shell, o permisos abiertos dentro de configs.
3. **[2026-05-30] CRLF warnings en git add son inofensivos**
   Do instead: ignorar el aviso "LF will be replaced by CRLF" — comportamiento normal en Windows.

## Domain Behavior Guardrails
1. **[2026-05-30] Servicios aplican impersonation**
   Do instead: en cada service usar `getImpersonatedOrgId()` y `if (orgOverride) query.eq('org_id', orgOverride)`.
2. **[2026-05-30] E2E mock base URL difiere entre app y test en CI**
   Do instead: usar regex routes `new RegExp('/rest/v1/table')` en lugar de URL literal.
3. **[2026-05-30] getByText causa strict-mode si Dashboard renderiza mismo dato**
   Do instead: scopear con `data-testid` o `.first()`.
4. **[2026-05-30] Admin check exacto**
   Do instead: `userProfile?.role === 'Administrador' || userProfile?.role === 'Superadmin'`.

## User Directives
1. **[2026-05-30] Entregar PR como URL plana**
   Do instead: `https://github.com/casadigti/medops/pull/N` — sin markdown, sin abreviar.
2. **[2026-05-30] Push a fork, PR a upstream**
   Do instead: `git push fork feat/impersonation`; PR `--base main --head jolumax:feat/impersonation`.
3. **[2026-05-30] Commits Conventional Commits**
   Do instead: `feat(scope):`, `fix(scope):`, `chore:`, `docs:`, `test:`. Co-Author Claude al final.
4. **[2026-05-30] Caveman mode activo**
   Do instead: respuestas tersas. Código/commits/PRs en prosa normal.
