# Slanje obaveštenja mejlom

Edge Function koja šalje ono što baza stavi u red `obavestenje` (migracija
`supabase/migrations/20261111010000_obavestenja.sql`). Pravila su u bazi; ovde
je samo slanje: jedan mejl po primaocu, preko Resend HTTP API-ja, pa
`oznaci_poslato`. Poziva se sa `?rezim=odmah` (na 5 minuta: hitno, i sve za
roditelje koji su izabrali „odmah“) ili `?rezim=dnevno` (u 8 ujutru po
Beogradu: dnevni pregled). Prima samo pozive sa `service_role` ključem.

## Šta treba (jednom, vlasnik kopije)

1. **Nalog na [resend.com](https://resend.com)** (besplatan plan šalje do 100
   mejlova dnevno). Pod *Domains* dodaj svoj domen i upiši DNS zapise koje
   Resend pokaže, pa pod *API Keys* napravi ključ (`re_…`). Bez svog domena
   Resend šalje samo na tvoju adresu, pa drugom roditelju mejl ne bi stigao.
2. **Tajne funkcije** (vrednosti su tvoje; ništa od ovoga ne ide u repo):

   ```bash
   npx supabase secrets set \
     RESEND_API_KEY=re_xxxxxxxx \
     OBAVESTENJA_FROM="coparenting <obavestenja@tvoj-domen.rs>" \
     APP_URL=https://<ime>.pages.dev
   ```

   `RESEND_API_KEY` je iz Resend-a; `OBAVESTENJA_FROM` je adresa na domenu
   koji si potvrdio u Resend-u; `APP_URL` je adresa tvoje kopije aplikacije
   (linkovi u mejlu vode na nju).

3. **Objavi funkciju** (iz foldera projekta, posle `npx supabase link`):

   ```bash
   npx supabase functions deploy obavestenja
   ```

4. **Ekstenzije u bazi**: Supabase → Database → Extensions, uključi `pg_cron`
   i `pg_net`. (Migracija `20261111020000_obavestenja_raspored.sql` pravi
   rasporede samo kad ih nađe; ako si je već primenio, pokreni je ponovo kroz
   SQL editor ili samo njen `do` blok.)

5. **Adresa funkcije i ključ u Vault-u** (Supabase → SQL editor), da ih
   raspored čita pri svakom pozivu, a da ne stoje ni u jednom fajlu:

   ```sql
   select vault.create_secret('https://<ref>.supabase.co/functions/v1/obavestenja', 'obavestenja_url');
   select vault.create_secret('<service_role ključ>', 'obavestenja_kljuc');
   ```

   `<ref>` je oznaka projekta (u adresi projekta). `service_role` ključ je pod
   Project Settings → API Keys (kartica sa starim, JWT ključevima: `anon` i
   `service_role`). To je tajni ključ: zaobilazi sva pravila u bazi, pa ne
   sme u kod, u pregledač ni u git.

## Rasporedi (migracija `20261111020000_obavestenja_raspored.sql`)

| Posao | Raspored (UTC) | Šta radi |
|---|---|---|
| `obavestenja-odmah` | `*/5 * * * *` | `pozovi_obavestenja('odmah')` |
| `obavestenja-dnevno` | `0 6,7 * * *` | `pozovi_obavestenja('dnevno')`; šalje samo u onom pozivu kad je u Beogradu 8 h (letnje/zimsko vreme) |

`public.pozovi_obavestenja(rezim)` čita adresu i ključ iz Vault-a i preko
`pg_net` šalje POST funkciji. Pozivi i odgovori se vide u tabeli
`net._http_response`; neuspeli mejlovi ostaju u `obavestenje` sa tekstom
greške u koloni `greska` i pokušavaju se ponovo (najviše 7 dana).

## Provera

```bash
# ručno, umesto rasporeda (ključ je service_role):
curl -X POST "https://<ref>.supabase.co/functions/v1/obavestenja?rezim=odmah" \
  -H "Authorization: Bearer <service_role ključ>"
# odgovor: {"rezim":"odmah","primalaca":1,"poslato":2,"neuspelo":0}
```

Lokalno (`npm run baza` bez `-x edge-runtime`, pa `npx supabase functions serve obavestenja --env-file supabase/.env`)
isto radi uz lokalni `service_role` ključ iz `npx supabase status`; mejl tada
zaista ide kroz Resend, pa za probu koristi svoju adresu.
