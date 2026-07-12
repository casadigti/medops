# MedOps — Claude Code Instructions

## What is this

Multi-tenant SaaS for surgical logistics management (Dominican Republic).
React 19 + Vite + Supabase (PostgreSQL + RLS + Edge Functions) + Vercel.

---

## Tech Stack

| Layer | Tech | Version |
|-------|------|---------|
| Language | TypeScript | 6.x |
| UI | React | 19.x |
| Bundler | Vite | 8.x |
| Styles | Tailwind CSS v4 (vite plugin) | 4.x |
| Backend | Supabase (PostgreSQL + RLS + Realtime) | JS SDK 2.x |
| Edge Functions | Deno (supabase/functions/) | — |
| State | Zustand | 5.x |
| Routing | React Router | 7.x |
| Forms | React Hook Form + Zod | — |
| Tests | Vitest (unit) + Playwright (e2e) | — |
| Deploy | Vercel | — |

---

## Project Structure

```
src/pages/          → One file per route
src/components/ui/  → Modal, Toast, Badge, Spinner, ConfirmDialog
src/components/layout/ → Sidebar, Layout, NotificationPanel
src/services/       → One service object per entity (CRUD via supabase-js)
src/types/domain.ts → ALL domain interfaces — single source of truth
src/lib/supabase.ts → Supabase client + restQuery helper
src/utils/cn.ts     → clsx + tailwind-merge
src/contexts/       → ImpersonationContext
supabase/migrations/  → SQL migrations (run MANUALLY in Supabase SQL Editor)
supabase/functions/   → Deno Edge Functions
```

---

## Conventions

### Naming
- Pages/components: `PascalCase.tsx`
- Services/utils: `camelCase.ts`
- Types: in `src/types/domain.ts` only

### Services pattern
```typescript
export const myService = {
  async getAll(): Promise<MyType[]> {
    const orgOverride = getImpersonatedOrgId();
    let query = supabase.from('table').select('*');
    if (orgOverride) query = query.eq('org_id', orgOverride);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
}
```

### Styles
- Tailwind utility classes directly
- `cn()` for conditional classes
- Semantic classes: `.card`, `.btn`, `.btn-primary`, `.btn-secondary`, `.input` (defined in `src/index.css`)
- Never use `<style>` tags in components

### Roles
`Superadmin` > `Administrador` > `Editor` > `Técnico` > `Lector` | `Cirujano` (separate portal)
Admin check: `userProfile?.role === 'Administrador' || userProfile?.role === 'Superadmin'`

### Multi-tenancy (CRITICAL)
- ALL tables have `org_id` with `DEFAULT get_my_org_id()`
- RLS uses `get_my_org_id()`, `get_my_role()`, `is_platform_admin()` helpers
- Services support impersonation via `getImpersonatedOrgId()` — always apply this
- Never hardcode org_id in code

### Migrations
- Manual execution in Supabase Dashboard → SQL Editor
- DO NOT use `supabase db push` (baseline history not synced)
- File: `supabase/migrations/000X_description.sql`

### Edge Functions (Deno)
- `inventory-search` MUST be deployed with the JWT-bypass flag (Telegram webhook has no Bearer token)
- Use: `npm run deploy:functions` (script already includes the correct flag)
- Secrets: Supabase Dashboard → Edge Functions → Secrets
  - `TELEGRAM_BOT_TOKEN` — Telegram bot
  - `GROQ_API_KEY` — voice transcription (Whisper)

---

## Build & Run

```bash
npm run dev               # dev server
npm run build             # production build
npm run lint              # ESLint
npm run test              # Vitest unit tests
npm run test:e2e          # Playwright E2E
npm run deploy:functions  # deploy all Edge Functions
```

---

## Adding a new page

1. Create `src/pages/MyPage.tsx` (export named `MyPage`)
2. Import in `src/App.tsx` and add `<Route>`
3. Add navItem to `src/components/layout/Sidebar.tsx` navItems array
4. Add navItem to `src/components/layout/Layout.tsx` mobile navItems array
5. Add types to `src/types/domain.ts`
6. Add service to `src/services/myService.ts`

---

## Adding a DB table

1. Write `supabase/migrations/000X_description.sql` with:
   - Table definition (include `org_id uuid NOT NULL DEFAULT get_my_org_id()`)
   - Indexes
   - RLS policies using `get_my_org_id()` / `get_my_role()` / `is_platform_admin()`
2. Execute manually in Supabase SQL Editor
3. Add TypeScript type to `src/types/domain.ts`
4. Add service to `src/services/`

---

## Git workflow

- Active branch: `feat/impersonation`
- Fork: `jolumax/medops` → PR to `casadigti/medops`
- Push to fork: `git push fork feat/impersonation`
- PR format: `https://github.com/casadigti/medops/pull/N` (plain URL, no markdown)
- Commits: Conventional Commits (`feat(scope):`, `fix(scope):`, `chore:`)

---

## Key env vars

```
VITE_SUPABASE_URL        → Supabase project URL
VITE_SUPABASE_ANON_KEY   → Supabase anon key
```

Edge Function secrets (Supabase Dashboard, not .env):
```
TELEGRAM_BOT_TOKEN
GROQ_API_KEY
```
