# classfolio

A gallery of students' personal websites (AI Engineering & Career Accelerator). Anyone can browse, add a site and react to sites. Only admins can edit or delete. Vite + React 19 + TypeScript, plain CSS with custom properties, Supabase (Postgres, Auth, RLS, Realtime). Deployed as a static site on Cloudflare Pages (Node 22, see `.node-version`).

## Commands

- `npm run dev`: dev server. For the in-app browser use the `dev` config in `.claude/launch.json` (port 5173).
- `npm run build`: `tsc -b` then `vite build`. Must pass before a change is done.
- `npm run lint`: oxlint (`.oxlintrc.json`). Must pass too.
- No test suite. Verify UI changes in the browser at desktop and mobile widths.
- **Local database with fake data** (needs Docker):
  - `npx supabase start` applies every migration plus `supabase/seed.sql`.
  - Then run `npm run dev:local`, or the `dev-local` config in `.claude/launch.json` (port 5181), which uses `.env.localdb`.
  - `npx supabase db reset` re-seeds. `npx supabase stop` shuts it down.
  - `supabase/seed.sql` is gitignored and exists only on the machine that made it. It holds 8 sites, 30 fake anonymous visitors with reactions, and a local test admin (credentials in its header). Without it, the local database starts empty.
  - To simulate another visitor reacting live, run `set_reaction` in psql as a fake user: `docker exec -i supabase_db_classfolio psql -U postgres`, then `set local role authenticated` and `set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000007","role":"authenticated"}', true)` in a transaction.
- Plain `npm run dev` has no `.env.local` here, so it runs "unconfigured" (no cards).

## Layout

```
src/
  App.tsx              state: sites, isAdmin, query, modals, focus restore, aria-live announcements
  lib/api.ts           GalleryApi interface + Supabase impl + 'unconfigured' fallback (fail closed)
  lib/types.ts         Site, SiteInput, SiteChange, reaction types
  lib/reactions.ts     reactions store (useSyncExternalStore): optimistic toggles + live totals
  lib/hooks.ts         useMediaQuery, useReducedMotion, useIsMobile (<768), useIsTablet, useReveal
  lib/preview.ts       screenshot URL (VITE_SCREENSHOT_URL_TEMPLATE, default Microlink)
  components/
    Wall.tsx           masonry: flat list positioned with transforms (FLIP), 3/2/1 columns
    SiteCard.tsx       card = frame link + caption (name, GitHub, Visit) + reactions row + admin buttons
    Odometer.tsx       rolling digits; `format` prop (default: zero-padded to 2)
    icons.tsx          all icons via the `Icon` wrapper (24 viewBox, stroke 1.8, round caps/joins)
    Header, Hero, Toolbar, Footer, Modal, SmallModals, SiteFormModal, States, SpaceBackground
  styles/tokens.css    design tokens (--bg, --surface, --text, --muted, --accent, --ease-out, fonts)
  styles/base.css      reset, :focus-visible ring, .visually-hidden
supabase/migrations/   schema; permissions live here (RLS + grants), not in the UI
```

Each component has its own `.css` next to it. The app is dark only (`color-scheme: dark`).

## Conventions

- **Permissions are enforced in the database.** The UI only mirrors them. New tables need RLS enabled plus explicit grants to `anon` / `authenticated` (see `20260930000000_explicit_api_grants.sql`), because new projects may not auto-expose tables. Helper functions are `security definer` with `set search_path = ''`, with `revoke all ... from public` and then explicit `grant execute`.
- **Add new schema as a new migration file.** Don't edit one that may already be applied.
- Every `GalleryApi` method also needs an entry in `unconfiguredApi()`.
- Call Supabase from `onAuthStateChange` callbacks only via `setTimeout`, or the auth lock can deadlock.
- Motion: always honour `prefers-reduced-motion` (both `useReducedMotion()` and a CSS media block). Hover-only effects go under `@media (hover: hover) and (pointer: fine)`, and touch rules under `(hover: none), (pointer: coarse)`.
- Accessibility: real `<button>`s and links, 44px touch targets, visible focus rings, curly apostrophes in copy (`’`). Announce important changes through App's aria-live region.
- Style: no semicolons, single quotes, 2-space indent, 120-column lines, and short comments that explain *why*.

## Auth and roles

- **Admins** sign in with email and password. `isAdmin()` means their user ID is in `public.admins`. A non-admin login is signed straight back out.
- **Visitors** are anonymous. On their first reaction, `api.react()` calls `auth.signInAnonymously()` (this needs both "Allow anonymous sign-ins" and "Allow new users to sign up" on in the dashboard). The session persists in localStorage, which gives each browser a stable `auth.uid()`. An admin login stashes the visitor session (`classfolio:visitor-session` in localStorage) and logout restores it, so the visitor's identity and reactions survive. If anonymous sign-in is disabled, `ReactionsUnavailableError` is thrown and the buttons become `aria-disabled` with a quiet tooltip.

## Reactions

- There are six fixed keys, in a fixed order: beautiful, story, creative, ux, professional, memorable (`REACTIONS` in `SiteCard.tsx`, holding labels, meanings, icons and hues). They're compliments, not ratings: no totals, rankings or "best" wording.
- Table `site_reactions (site_id, user_id, reaction)`. RLS lets a user read only their own rows ("mine"). Everyone reads totals via the `site_reaction_counts()` RPC.
- **All writes go through the `set_reaction(p_site_id, p_reaction, p_on)` RPC.** It refuses admins and anyone without a session. It takes an advisory lock per (site, reaction), writes, returns `{ total, version }` (version = epoch microseconds), and calls `realtime.send` on the public broadcast channel `site_reactions` (event `count`) with totals only, never user IDs.
- Client store (`lib/reactions.ts`):
  - Totals are applied only if their `version` is newer.
  - Live totals for a reaction whose request is in flight are deferred until it settles.
  - A full reload runs on (re)subscribe and on auth changes, and loads that race a toggle are discarded.
- Admins see `ReactionCounts`, a read-only `<ul>` with the same look and live counts. Everyone else sees `ReactionBar` (buttons, tooltips, tap-to-flash labels on touch, pop and sparkle animation on select).
