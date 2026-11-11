# Deploying your own copy

A copy needs a GitHub account and a free account at [supabase.com](https://supabase.com). Placeholders:
`<ref>` is your Supabase project's reference (it is in the project's address), `<name>` your site's name.

1. **Code.** Fork this repository, or clone it and push it to your own.
2. **Database.** On supabase.com create a project (a region in the EU, for example Frankfurt), then in the project
   folder:

   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push        # every table, rule and function from supabase/migrations
   ```

   Later migrations reach the project the same way, or through the Supabase GitHub integration on a push to
   `main` (Project Settings, Integrations, GitHub, working directory `supabase`).
3. **Sign-in** (Supabase, Authentication):
   - URL Configuration: the Site URL and the Redirect URLs point to your site, for example
     `https://<name>.pages.dev` and `https://<name>.pages.dev/**`.
   - Providers, Email: e-mail confirmation on; a minimum password length of 10, with letters and digits (as
     locally in `supabase/config.toml`).
   - Emails, SMTP: set up your own SMTP server. The built-in sender mails only the members of your Supabase team,
     so the other parent would never get the confirmation e-mail.
   - MFA (TOTP) is on in Supabase by default.
4. **The site on Cloudflare Pages** (recommended: the app gets its own address, `<name>.pages.dev`, apart from your
   other sites):
   - Workers & Pages, Create application, Pages, Import an existing Git repository; pick your repository.
   - Framework preset Astro, build command `npm run build`, output `dist` (the Node version is in
     `.node-version`).
   - Environment variables: `PUBLIC_SUPABASE_URL` (`https://<ref>.supabase.co`) and `PUBLIC_SUPABASE_KEY` (Project
     Settings, API Keys, the publishable key). Without them the site is the demo only.
   - Every push to `main` publishes a new version.

   Or **GitHub Pages**, through `.github/workflows/pages.yml`, which is off until you turn it on: Settings, Pages,
   Source: GitHub Actions; then under Settings, Secrets and variables, Actions, Variables set `OBJAVI_PAGES` to
   `da` and the same two Supabase settings. The address is `https://<user>.github.io/<repository>/`. Your other
   GitHub Pages sites live on the same origin and so share the sign-in kept in the browser.
5. **Who may open a family space.** While the table `dozvoljeni_osnivac` is empty, anyone who makes an account can
   open a space. To keep your copy for your own family, add your e-mail (Supabase Table editor, or
   `insert into public.dozvoljeni_osnivac (email) values ('you@example.com');`). The other parent still comes in
   through the invitation.
6. **Google sign-in** (optional): in the Google Cloud Console make an OAuth client (Web application) with the
   redirect URI `https://<ref>.supabase.co/auth/v1/callback`, and enter it in Supabase, Authentication,
   Providers, Google.
7. **E-mail notifications** (optional; without them the app works, only no e-mail goes out): an account at
   [resend.com](https://resend.com) with a verified domain; the function's secrets `RESEND_API_KEY`,
   `OBAVESTENJA_FROM` and `APP_URL` (`npx supabase secrets set`); `npx supabase functions deploy obavestenja`; the
   extensions `pg_cron` and `pg_net` turned on; the function's address and the service-role key in Vault as
   `obavestenja_url` and `obavestenja_kljuc`. The exact commands, and where each value comes from:
   `supabase/functions/obavestenja/README.md`.

If your copy takes in other families, you keep their data, health data included. Think about a privacy notice and
account deletion for them first; the app's own are described in
[product/features/privacy.md](../product/features/privacy.md).

## Checking a running copy

- The schedule's calls and their answers: the table `net._http_response`.
- E-mails that failed: rows in `obavestenje` with `greska` set; they are tried again for up to 7 days.
- A manual send, instead of waiting for the schedule, is in `supabase/functions/obavestenja/README.md`.
