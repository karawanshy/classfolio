# classfolio

A gallery of the personal websites built by students of the **AI Engineering & Career Accelerator by Mohammad Kabajah**. Anyone can browse and add a site. Only admins can edit or delete entries.

Built with Vite, React and TypeScript, using plain CSS with custom properties. Data and admin auth run on Supabase (Postgres, Auth and Row Level Security), and the app deploys as a static site.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev
```

The app needs a Supabase project (see below). Without the env vars it shows "Couldn't load the gallery".

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (Project Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key. It is safe in the browser because RLS enforces every permission. |
| `VITE_SCREENSHOT_URL_TEMPLATE` | Screenshot provider URL. `{url}` is replaced with the encoded site URL. Defaults to Microlink with a 1280×800 viewport. |

Set the same variables in your host's dashboard (Netlify, Vercel, Cloudflare Pages, …). Build command: `npm run build`. Publish directory: `dist`.

## Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com). The free tier is enough.
2. **Apply the schema.** Either:
   - with the CLI: `supabase link --project-ref <ref>` and then `supabase db push`, or
   - paste `supabase/migrations/20260929000000_create_sites.sql` into **SQL Editor** and run it.

   This creates the `sites` and `admins` tables, the validation constraints, the RLS policies and column grants, and adds `sites` to Realtime.
3. **Turn off public sign-ups:** Authentication → Sign In / Providers → uncheck *Allow new users to sign up*. Non-admin accounts can't do anything, but there's no reason to allow them.
4. **Create the first admin:**
   1. Authentication → Users → *Add user* → *Create new user*. Enter an email and password and tick *Auto confirm*.
   2. In the SQL Editor, run:
      ```sql
      insert into public.admins (user_id)
      select id from auth.users where email = 'staff@example.com';
      ```
   3. Repeat for each staff member. To remove an admin, delete their row from `public.admins`.

   **Where credentials live:** admin emails and passwords are stored only in Supabase Auth (`auth.users`, with passwords hashed by bcrypt). They are never in this repo, in env vars or in the frontend bundle. `public.admins` holds only user IDs. To change a password, use Authentication → Users → the user's menu → *Send password recovery*, or set a new one from the dashboard.
5. Log in on the site with the pen icon in the header.

### What the database enforces

- `select`: anyone.
- `insert`: anyone. Only the form columns can be written: `id`, `created_at` and `screenshot_url` cannot be set by visitors. Check constraints require a name of 1–80 characters after trimming, and `http(s)://` URLs of 300 characters or fewer. The hidden honeypot field must be empty.
- `update` / `delete`: only signed-in users listed in `admins`, via the `is_admin()` security-definer function.
- `admins`: each user can read only their own row. It cannot be written from the client.

## Screenshots

Each card calls `getPreviewUrl(siteUrl)` (in `src/lib/preview.ts`), which fills in `VITE_SCREENSHOT_URL_TEMPLATE`. If a row has a `screenshot_url`, that value is used instead.

- Microlink's free tier is rate-limited. For a whole class, capture each site once and store the result in `screenshot_url`, for example with a Supabase Edge Function or a small script using the service-role key. You can also use a paid Microlink key or another provider.
- The hover "peek" scrolls through the page when the image is a **full-page** capture (taller than about 4:3). Add `&screenshot.fullPage=true` to the Microlink template to get one. With viewport-only captures the card zooms in gently instead.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run og` | Re-render `public/og.png` from `scripts/og.html` with headless Chrome (macOS path) |

After deploying, you may want to make `og:image` in `index.html` an absolute URL on your domain. Some link-preview scrapers ignore relative URLs.
