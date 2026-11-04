# co-parenting-app

Zajedničko mesto za dva roditelja koji odvojeno brinu o detetu: pitanja i
dogovori, kalendar (kod koga je dete, treninzi, rođendani), karton deteta i
dokumenti. Osnovno pravilo: **niko ne menja sam ono što se tiče oboje.**
Zatvaranje dogovora, svaka promena kalendara i trajno brisanje dokumenta
traže pristanak drugog roditelja, i to pravilo stoji u bazi, ne samo u
aplikaciji.

*English: a shared space for two separated parents — questions and
agreements, a custody and activities calendar, the child's record and
documents. Anything that concerns both needs the other parent's consent, and
the database enforces it. The interface is in Serbian (Latin script).*

**Probaj bez naloga:** pokreni lokalno (ispod) ili otvori bilo koju objavljenu
kopiju sa `?demo=1` na kraju adrese. Demo radi na probnim podacima u
pregledaču; birač **Tata / Mama** gore menja ulogu, pa se ceo tok može
probati sam.

## Šta ima

- **Početna**: šta je hitno, šta čeka tebe, a šta drugog roditelja, kod koga
  je dete i kad je sledeća primopredaja.
- **Stavke**: pitanja i teme kao tabla (Stavke · Aktivno · Rešeno) sa
  prevlačenjem, lista sa filterima i izvozom CSV, i istorija dogovora.
  Zatvaranje predlaže jedan roditelj, a potvrđuje drugi.
- **Kalendar**: dan, nedelja, mesec i raspored, u stilu Google kalendara.
  Boravak deteta (redovan raspored i jednokratne promene) i aktivnosti koje se
  ponavljaju. Svaka promena, i prevlačenje, postaje predlog koji drugi
  roditelj prihvata ili odbija.
- **Karton**: škola, zdravlje, važni kontakti, mere i veličine, vanškolske
  aktivnosti, drugari, raspored časova (ručno, CSV/Excel ili slika). Svaka
  izmena se pamti: staro, novo i ko je promenio.
- **Dokumenti**: potvrde, nalazi, računi i skenovi u privatnom skladištu.
  Brisanje samo skloni dokument u „Obrisani“; trajno brisanje traži oba
  roditelja.
- **Profil roditelja**: telefon, adresa za primopredaju, mejl, napomena.
- **Nalozi**: mejl i lozinka sa potvrdom mejla, dvostepena prijava (MFA,
  kodovi iz aplikacije), opciono Google. Prvi roditelj otvara porodični
  prostor i šalje drugom link za poziv (važi 7 dana, radi jednom).
- Radi na telefonu i računaru; ime deteta se nigde ne prikazuje.

## Kako je zaštićeno

- Aplikacija je statična (Astro + Svelte). Podaci su u Supabase-u (Postgres),
  a pregledač razgovara direktno sa njim; server ne treba.
- Svaka porodica ima svoj prostor. Pravila u bazi (RLS) puštaju roditelja
  samo do podataka njegove porodice; kad je MFA uključen, tek posle koda.
- U tabele se ne piše direktno. Svaka promena ide kroz funkciju u bazi, koja
  proverava ko pita i da li sme (npr. predlog kalendara ne može da prihvati
  onaj ko ga je dao).
- Dokumenti su u privatnoj kanti, otvaraju se linkom koji važi 10 minuta, a
  otpremljen fajl niko ne može da zameni ni obriše bez pristanka oba
  roditelja.
- Javni ključ u kodu (`PUBLIC_SUPABASE_KEY`, „publishable key“) je napravljen
  da bude javan; tajni ključevi se nigde ne koriste.

## Podigni svoju kopiju

Treba ti nalog na GitHub-u i besplatan nalog na [supabase.com](https://supabase.com).

1. **Kod**: napravi fork ovog repoa (ili ga kloniraj i pošalji u svoj).
2. **Baza**: na supabase.com napravi projekat (region u EU, npr. Frankfurt),
   pa u folderu projekta:

   ```bash
   npm install
   npx supabase login
   npx supabase link --project-ref <ref-tvog-projekta>
   npx supabase db push        # sve tabele, pravila i funkcije iz supabase/migrations
   ```

3. **Prijava** (Supabase → Authentication):
   - *URL Configuration*: Site URL i Redirect URLs na adresu sajta, npr.
     `https://<ime>.pages.dev` i `https://<ime>.pages.dev/**`.
   - *Providers → Email*: uključena potvrda mejla; minimalna lozinka 10
     znakova, slova i brojevi (kao lokalno u `supabase/config.toml`).
   - *Emails → SMTP*: podesi svoj SMTP (npr. Gmail sa lozinkom za aplikacije
     ili Resend). Ugrađeno slanje šalje mejlove samo članovima tvog Supabase
     tima, pa drugom roditelju mejl za potvrdu ne bi stigao.
   - MFA (TOTP) je na Supabase-u uključen podrazumevano.
4. **Sajt na Cloudflare Pages** (preporuka; aplikacija dobija svoju adresu
   `<ime>.pages.dev`, odvojenu od tvojih drugih sajtova):
   - *Workers & Pages → Create application → Pages → Import an existing Git
     repository*, izaberi svoj repo.
   - Framework preset **Astro**, build `npm run build`, izlaz `dist`
     (Node verzija je u `.node-version`).
   - *Environment variables*: `PUBLIC_SUPABASE_URL` (npr.
     `https://<ref>.supabase.co`) i `PUBLIC_SUPABASE_KEY` (Project Settings →
     API Keys → publishable key). Bez njih je sajt samo demo.
   - Svaki push na `main` objavi novu verziju.

   Ili **GitHub Pages** (workflow je u `.github/workflows/pages.yml`, isključen
   dok ga ne uključiš): *Settings → Pages → Source: GitHub Actions*, pa pod
   *Settings → Secrets and variables → Actions → Variables* `OBJAVI_PAGES` =
   `da` i iste dve Supabase promenljive. Adresa je
   `https://<korisnik>.github.io/<ime-repoa>/`; na njoj su i tvoji ostali
   GitHub Pages sajtovi, pa dele prijavu sačuvanu u pregledaču.
5. **Ko sme da otvori prostor**: dok je tabela `dozvoljeni_osnivac` prazna,
   svako ko napravi nalog može da otvori svoj porodični prostor. Ako hoćeš da
   tvoja kopija bude samo za tvoju porodicu, upiši svoj mejl (Supabase → Table
   editor, ili SQL `insert into public.dozvoljeni_osnivac (email) values
   ('ti@primer.rs');`). Drugi roditelj i dalje ulazi preko poziva.
6. **Google prijava** (opciono): u Google Cloud Console napravi OAuth klijent
   (Web application) sa redirect URI `https://<ref>.supabase.co/auth/v1/callback`,
   pa ga upiši u Supabase → Authentication → Providers → Google.

Ako tvoja kopija prima druge porodice, ti čuvaš njihove podatke (i
zdravstvene); pre toga razmisli o obaveštenju o privatnosti i brisanju naloga.

## Lokalni razvoj

```bash
npm install
npm run dev         # http://127.0.0.1:8040, demo podaci u pregledaču
npx astro dev stop  # Astro dev server radi u pozadini
```

Sa pravom bazom lokalno (treba Docker):

```bash
npm run baza        # lokalni Supabase (prvi put preuzima slike)
npm run dev:baza    # aplikacija sa nalozima; adresu i ključ čita iz pokrenute baze
npm run baza:stop
```

Portovi: aplikacija 8040, API 8041, Postgres 8042, Studio 8043 (pregled
tabela), Mailpit 8044 (lokalni inbox za mejlove potvrde), 8045–8048 interno.
Sa bazom, `?demo=1` uključuje demo, a `?demo=0` ga gasi.

Lokalna Google prijava: redirect URI `http://127.0.0.1:8041/auth/v1/callback`,
id i tajna u `supabase/.env` kao `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` i
`SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` (fajl se ne commituje), pa
`enabled = true` pod `[auth.external.google]` u `supabase/config.toml`.

## Provere

```bash
npm test             # pravila aplikacije (Vitest)
npm run check        # astro check + svelte-check, bez grešaka i upozorenja
npm run test:baza    # pravila baze (pgTAP): porodica, MFA, stavke, kalendar, karton, dokumenti, profil, ko šta vidi
npm run smoke        # demo kroz headless Chrome: stavke, tabla, kalendar, karton, dokumenti, profil
npm run smoke:nalog  # dva prava naloga u odvojenim pregledačima (treba baza + dev:baza)
```

## Struktura

```
src/lib/tipovi.ts          pojmovi: stavka, stanje, oblast, unos
src/lib/domen.ts           pravila stavki: ko je na potezu, hitno, prelazi stanja, pregled
src/lib/kalendar.ts        boravak: ko ima dete, zahtevi koje drugi roditelj prihvata
src/lib/dogadjaji.ts       aktivnosti: ponavljanje, raspored blokova, prevlačenje kao predlog
src/lib/karton.ts          karton: polja, spiskovi, istorija izmena
src/lib/raspored-casova.ts raspored časova: ručno, CSV/Excel (.xlsx bez biblioteke), slika
src/lib/dokumenti.ts       dokumenti: kategorije, provere, brisanje i trajno brisanje
src/lib/profil.ts          profil roditelja
src/lib/izvor.ts           interfejs ka podacima: demo (mock/) bez naloga, baza sa nalogom
src/lib/izvor-supabase.ts  stavke, kalendar i karton iz baze
src/lib/nalog.ts           prijava, MFA, porodični prostor, poziv
src/components/            Svelte ekrani
supabase/migrations/       šema, pravila (RLS) i funkcije
supabase/tests/            testovi baze (pgTAP)
scripts/                   testovi kroz pregledač
docs/PLAN.md               plan, odluke i faze (na srpskom)
```

## Licenca

[MIT](LICENSE)
