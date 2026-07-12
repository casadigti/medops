---
name: arranque
description: Manual para arrancar un proyecto nuevo desde cero. Usar cuando el usuario diga "nuevo proyecto", "arrancar un proyecto", "empezar desde cero", "proyecto nuevo", "scaffold", "setup inicial", "crea el repo", o cuando el directorio de trabajo esté vacío o sin git. Cargar ANTES de escribir la primera línea de código o correr el primer comando de scaffolding.
---

# Arranque de proyecto

Este manual sale de la autopsia de MedOps (mayo–julio 2026). Cada regla aquí
existe porque saltársela costó días de retrofit en ese proyecto. No son
preferencias de estilo: son cicatrices.

## Fase 0 — Antes de escribir código (30 minutos, no más)

Responder por escrito, en el futuro CLAUDE.md, tres preguntas:

1. **¿Qué problema resuelve?** Una frase. Si no cabe en una frase, el alcance
   ya está mal.
2. **¿Quién lo usa?** Roles concretos desde el día 1. En MedOps los roles
   (Admin/Técnico/Cirujano) y el multi-tenant aparecieron DESPUÉS del código,
   y retrofitear `org_id` + RLS + impersonation en todos los servicios costó
   una migración completa (`0001_multitenancy`) y semanas de fixes RLS.
   **Pregunta obligatoria: ¿esto algún día lo usará más de una organización?
   Si la respuesta es "quizás", el tenant-id va en el esquema desde la
   primera tabla.** Agregarlo después es la deuda más cara que existe.
3. **¿Cuál es la primera cosa visible que demuestra que funciona?** Una
   pantalla, un endpoint, un comando. Eso — y solo eso — es el objetivo de
   la semana 1. En MedOps se "lanzó v1.0" con 23 commits el día 1: PDF,
   PWA, analytics, calendario... y sin un solo test ni tipos. Todo eso se
   pagó después con intereses.

Si el usuario no puede responder las tres, preguntarle. No inventar.

## Fase 1 — Stack mínimo y aburrido

Regla: **una decisión reversible vale más que la "perfecta"**. Elegir lo que
ya se conoce, anotar el porqué en CLAUDE.md (sección "Decisiones"), y seguir.

Stack por defecto del usuario (el de MedOps — usarlo salvo que el proyecto
exija otra cosa, y si la exige, anotar por qué):

```bash
npm create vite@latest mi-app -- --template react-ts   # TS desde el minuto 0
cd mi-app
npm i @supabase/supabase-js zustand react-router-dom react-hook-form zod
npm i tailwindcss @tailwindcss/vite clsx tailwind-merge
npm i -D vitest @playwright/test
```

- **React + Vite + TypeScript**: NUNCA arrancar en JSX "para ir rápido".
  MedOps arrancó en JSX y la migración a TS tres semanas después tocó
  literalmente todos los archivos del repo en un solo día de commits.
- **Supabase** (auth + Postgres + RLS + realtime): un backend entero sin
  servidor propio. Fue de las mejores decisiones de MedOps.
- **Tailwind v4 vía plugin de Vite** (`@tailwindcss/vite`), no PostCSS
  clásico — la integración vieja rompió el primer deploy de MedOps.
- **Vercel** para deploy del frontend.
- Nada más. Ni monorepo, ni Docker, ni microservicios, ni capa de
  abstracción sobre Supabase. Cero capas para problemas que todavía no
  existen: si el problema no ha aparecido, la capa que lo "previene" es
  solo código que hay que mantener.

## Fase 2 — Día 1 no negociable

En este orden, ANTES de la primera feature:

1. **Gitignore y archivo de entorno ANTES del primer commit.**
   ```bash
   git init
   # gitignore: node_modules, dist, archivos de entorno (.env y variantes),
   #            playwright-report, test-results
   # archivo de entorno: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
   ```
   Cicatriz: MedOps commiteó URL de producción y project-ref en fixtures de
   e2e, y un UID/email real de Superadmin en un script. Una vez en el
   historial de git, no sale. Regla: **ningún ID real, email real, URL de
   producción ni credencial entra a git, ni siquiera en tests o scripts.**
   Los fixtures usan `process.env` con fallback a valores locales falsos.

2. **Primer commit = scaffold limpio.** Conventional Commits desde el
   commit 1 (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

3. **CLAUDE.md commiteado el día 1.** MedOps lo creó dos meses tarde y cada
   sesión de IA re-derivaba convenciones desde cero (y algunas las derivaba
   mal). Contenido mínimo: qué es el proyecto (las 3 respuestas de Fase 0),
   tabla del stack, estructura de carpetas explicada, comandos de
   build/test/deploy, convenciones de naming, y la sección "Decisiones" con
   el porqué de cada elección. Se actualiza en el mismo PR que cambia lo
   que documenta.

4. **Estructura explicada, no solo creada:**
   ```
   src/pages/       → un archivo por ruta
   src/components/  → ui/ y layout/
   src/services/    → un objeto service por entidad (único lugar que toca supabase)
   src/types/domain.ts → TODOS los tipos de dominio, única fuente de verdad
   src/lib/supabase.ts → cliente
   supabase/migrations/ → SQL numerado
   ```
   Esta estructura aguantó 17+ páginas en MedOps sin reorganizarse. Es de
   lo que mejor funcionó — copiarla.

5. **Deploy el día 1 aunque sea un "hola".** MedOps SÍ hizo esto y fue de
   sus mejores decisiones: el bug de integración de Tailwind salió a la luz
   el mismo día 1 y no en la semana 3.
   ```bash
   npx vercel link && npx vercel --prod
   ```
   Regla derivada: si hay backend desplegable (Edge Functions), el deploy
   va en UN script (`npm run deploy:functions`) con todos sus flags, desde
   el primer día. En MedOps un fix de seguridad crítico (cross-tenant
   account takeover) quedó "corregido en local, pendiente de redeploy"
   porque desplegar funciones era un paso manual que se olvidaba.

6. **Base de datos: disciplina de migraciones desde 0000.**
   - `supabase/migrations/0000_baseline.sql` numerado, y el CLI vinculado
     (`supabase link`) ANTES de la primera migración, para que
     `supabase db push` funcione siempre. En MedOps el baseline nunca se
     sincronizó y el proyecto quedó condenado a ejecutar SQL a mano en el
     Dashboard para siempre, con un HANDOFF.md llevando la cuenta manual de
     qué migración corrió en producción.
   - Números únicos y secuenciales (MedOps tiene dos `0001_*.sql`).
   - RLS activado en CADA tabla desde su creación, no "después". La
     auditoría de MedOps (día 21) encontró tablas sin políticas.
   - Si multi-tenant era "quizás" en Fase 0: `org_id uuid NOT NULL DEFAULT
     get_my_org_id()` en cada tabla desde la primera.

7. **Un test que corre, aunque pruebe una tontería.** `npm run test` verde
   el día 1. MedOps escribió su primer test 18 días después del "release
   v1.0". No se trata del coverage: se trata de que el arnés exista para
   que escribir el segundo test sea barato.

8. **Seguridad de base, no de auditoría:**
   - `escapeHtml` en utils el día 1; prohibido interpolar datos en
     `document.write`/`innerHTML` sin escapar. MedOps tuvo el MISMO stored
     XSS dos veces (Reportes en mayo, Bandejas en julio) porque el patrón
     nunca se prohibió, solo se parchó.
   - Contraseñas/tokens generados con `crypto.getRandomValues`, jamás
     `Math.random()`.
   - Mínimo de contraseña ≥ 12 desde el día 1 (MedOps arrancó con 6).

## Fase 3 — Cero sobre-ingeniería

- No crear abstracciones "por si acaso". El patrón service directo sobre
  supabase-js aguantó todo MedOps sin repositorios, ni DTOs, ni inyección
  de dependencias.
- No agregar librería nueva si una existente del stack resuelve el 80%.
- No optimizar bundle, ni cachear, ni memoizar sin una medición que duela.
- Sí está permitido: borrar código. Siempre.

## Regla de trabajo diaria (cicatriz de UI)

**Verificar en el navegador ANTES de commitear cambios visuales.** El
2026-06-09 MedOps acumuló 8 commits seguidos peleando con una sola barra de
filtros CSS porque cada intento se commiteaba a ciegas. Un vistazo con el
preview/browser tool por iteración habría sido 1 commit.

## Checklist de salida del arranque

El arranque terminó cuando TODO esto es verdad:

- [ ] Las 3 preguntas de Fase 0 respondidas y escritas en CLAUDE.md
- [ ] Repo git con primer commit limpio; archivo de entorno fuera de git;
      cero IDs/credenciales/URLs de producción en el código (incluidos
      tests y scripts)
- [ ] CLAUDE.md commiteado: stack, estructura, comandos, convenciones,
      sección "Decisiones" con porqués
- [ ] TypeScript estricto desde el archivo 1 (`npx tsc --noEmit` limpio)
- [ ] Deploy en producción funcionando, aunque muestre "hola"
- [ ] Si hay funciones/backend: deploy en UN script npm con sus flags
- [ ] Migración `0000` aplicada vía CLI (`supabase db push` funciona);
      RLS activo en toda tabla existente
- [ ] Decisión de tenancy tomada explícitamente (y si es "quizás multi",
      tenant-id ya está en el esquema)
- [ ] `npm run test` y `npm run lint` verdes (mínimo un test real)
- [ ] `escapeHtml` (o equivalente) existe y es la regla, no la excepción
- [ ] La "primera cosa visible" de Fase 0 se puede enseñar a alguien en
      una URL

Si falta un punto, el arranque no terminó — no importa cuántas features haya.
