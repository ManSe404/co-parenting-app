# Baza (Supabase)

- `migrations/`: šema, pravila (RLS) i funkcije, redom kako se primenjuju.
  Ništa se ne piše direktno u tabele; svaka promena ide kroz funkciju koja
  proverava ko pita. Primenjene migracije se ne menjaju, nego se dodaje nova.
- `tests/`: testovi baze (pgTAP), `npm run test:baza` lokalno.
- `config.toml`: lokalni Supabase (`npm run baza`). U oblaku se podešavanja
  prijave (adresa sajta, lozinke, SMTP) postavljaju u dashboard-u.

Migracije u oblak šalje Supabase GitHub integracija na svaki push na `main`
(Project Settings → Integrations → GitHub, working directory `supabase`), ili
ručno `npx supabase db push`.

Ko sme da otvori porodični prostor: tabela `dozvoljeni_osnivac`. Prazna znači
svako; sa mejlovima samo ti nalozi (drugi roditelj uvek ulazi preko poziva).
