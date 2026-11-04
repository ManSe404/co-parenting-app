# Coparenting app — plan

Naziv: `co-parenting-app` · nacrt od 2026-11-03 · odluke u odeljku 9.

## 1. Šta pravimo

Jedno zajedničko mesto za oba roditelja jednog deteta. Tu se postavljaju pitanja,
beleže odgovori i odluke i prati sve što se tiče škole, zdravlja, vanškolskih
aktivnosti i detetovih potreba. Pristupaju samo dva roditelja i oba imaju ista prava.

Ovo nije ćaskanje. Svaka stavka je jedna tema sa jasnim stanjem: čeka odgovor,
dogovaramo se ili rešeno. Kad se tema zatvori, odluka ostaje zapisana.

## 2. Principi

- **Jednostavno.** Glavna su tri ekrana: početna (dashboard), lista stavki i
  jedna stavka. Na telefonu se instalira kao aplikacija (PWA).
- **Ništa se ne briše.** Stavka se zatvara, ne briše. Svaka izmena pamti ko ju je
  napravio i kada. To štiti oba roditelja podjednako.
- **Ista prava.** U aplikaciji nema admina.
- **Dizajn kao na sajtu.** Isti tokeni kao manse404.github.io/webpage:
  Space Grotesk + DM Mono, tamna podloga, teal i ljubičasti akcenat, kartice sa
  tankom ivicom, čipovi, mali mono natpisi iznad sekcija. Bez animirane pozadine.
  Pored tamne ide i svetla tema koja prati podešavanje telefona.
- **Privatnost.** Podaci o detetu, uključujući zdravlje, čuvaju se u EU. Pristup
  imaju samo dva naloga. Nema analitike ni praćenja.

## 3. Pojmovi

Osnovna jedinica je **stavka**, odnosno pitanje ili tema. Svaka stavka ima tri
nezavisne osobine:

| Osobina | Vrednosti | Napomena |
|---|---|---|
| Stanje | Neodgovoreno · Otvoreno · Zatvoreno | tok jedne teme |
| Oblast | Škola · Zdravlje · Vanškolske aktivnosti · Detetove potrebe · Ostalo | tačno jedna |
| Oznake | Važno · Hitno | obe, jedna ili nijedna |

Važno i Hitno su oznake, a ne oblasti. Stavka „Hitno + Zdravlje“ je jedna stavka
i vidi se i pod Hitno i pod Zdravlje.

### Predlog značenja stanja

- **Neodgovoreno**: jedan roditelj je postavio pitanje, a drugi još nije odgovorio.
  Uvek se vidi ko je na potezu.
- **Otvoreno**: oba roditelja su se uključila, ali odluka još nije doneta.
- **Zatvoreno**: odluka je zapisana ili tema više nije aktuelna.

Prelazi:

- nova stavka → Neodgovoreno; čeka drugog roditelja
- drugi roditelj odgovori → Otvoreno (automatski)
- zatvaranje traži upis odluke. Predlog je da jedan roditelj predloži zatvaranje,
  a drugi ga potvrdi.
- zatvorena stavka može ponovo da se otvori, uz upisan razlog

**Hitno** se postavlja ručno. Pored toga, pod Hitno automatski ulazi svaka
nezatvorena stavka čiji rok ističe u naredna 3 dana.

## 4. Početna (dashboard)

```
┌────────────────────────────────────────────────────────────────┐
│ utorak, 3. novembar                                            │
│ ČEKA TEBE 2  ·  ČEKA MAMU 1  ·  NOVO OD POSLEDNJE POSETE 3     │
├────────────────────┬────────────────────┬──────────────────────┤
│ NEODGOVORENO   3   │ OTVORENO   5       │ ZATVORENO (30 d)  4  │
├────────────────────┴──────┬─────────────┴──────────────────────┤
│ HITNO                     │ VAŽNO                              │
│ · Potvrda za izlet   ⏱ 2d │ · Letovanje: termini               │
│ · Kontrola kod lekara     │ · Upis na plivanje                 │
├─────────────┬─────────────┼──────────────┬─────────────────────┤
│ ŠKOLA     3 │ ZDRAVLJE  2 │ VANŠKOLSKE 1 │ DETETOVE POTREBE 2  │
│ dve stavke  │ dve stavke  │ jedna stavka │ dve stavke          │
├─────────────┴─────────────┴──────┬───────┴─────────────────────┤
│ PREDSTOJEĆE (14 dana)            │ NOVO OD POSLEDNJE POSETE    │
│ čet 5.11  roditeljski sastanak   │ mama: odgovorila na „Jakna“ │
│ pon 9.11  rok: potvrda za izlet  │ mama: nova stavka „Izlet“   │
└──────────────────────────────────┴─────────────────────────────┘
```

Redosled (2026-11-03), isti na telefonu i računaru:
**Hitno + Važno** na vrhu → Čeka tebe / Čeka mamu / Novo → Na tebi je → Tabla
(traka sa brojem stavki po kolonama) → oblasti → Predstojeće → Novo od poslednje
posete. Hitno mora uvek da se vidi: crvena ivica, odbrojavanje roka („kasni 1 dan“,
„danas“, „za 2 dana“). Prazno Hitno postaje mirna siva kartica.

Ton početne je ljudski: pozdrav po dobu dana, ime deteta i jedna rečenica
umesto zida brojeva („Dve stvari su hitne. Na tebi su tri teme.“). Oblasti imaju
ikonice i svoju boju.

**Iz zahteva:** Neodgovoreno, Otvoreno, Zatvoreno; Važno, Hitno; Škola, Zdravlje,
Vanškolske aktivnosti, Detetove potrebe.

**Predlog dodataka:**

| # | Dodatak | Šta daje | Faza |
|---|---|---|---|
| 1 | Čeka tebe / čeka drugog roditelja | deli Neodgovoreno po tome ko je na potezu; najkorisniji broj na ekranu | v1 |
| 2 | Predstojeće (14 dana) | rokovi stavki i termini: pregledi, roditeljski sastanci, takmičenja | v1 |
| 3 | Novo od poslednje posete | šta je drugi roditelj dodao ili odgovorio od tvoje poslednje posete | v1 |
| 4 | Karton deteta | stalni podaci: pedijatar, škola i učitelj(ica), treneri, alergije i terapija, veličina odeće i obuće | v1, kao Karton (2026-11-04), odeljak 5 |
| 5 | Kod koga je dete + sledeća primopredaja | raspored boravka | v1, kao Kalendar (2026-11-04), odeljak 5 |
| 6 | Zajednički troškovi | ko je šta platio i saldo | v3, samo ako oba roditelja žele |

## 5. Ekrani

- **Početna**: odeljak 4.
- **Stavke: Tabla** (podrazumevano). Tri kolone: **Stavke** (neodgovoreno),
  **Aktivno** (otvoreno) i **Rešeno** (zatvoreno + predlozi koji čekaju potvrdu).
  Kartice se prevlače levo-desno: mišem odmah, a na telefonu posle kratkog
  zadržavanja prsta, da bi običan pokret i dalje skrolovao. Šta prevlačenje znači:

  | Odakle → kuda | Šta se dešava |
  |---|---|
  | Stavke → Aktivno | pomera u Aktivno, uz napomenu koja nije obavezna (npr. „pričali smo telefonom“) |
  | Stavke ili Aktivno → Rešeno | predlog zatvaranja: traži odluku, a drugi roditelj potvrđuje |
  | Rešeno (svoj predlog) → Aktivno | povlači predlog |
  | Rešeno (tuđi predlog) → Aktivno | odbija predlog, uz razlog |
  | Rešeno (zatvoreno) → Aktivno | ponovo otvara, uz razlog |
  | bilo šta → Stavke | nije dozvoljeno; poruka objašnjava zašto |

  Predlog koji čeka tvoju potvrdu ima na kartici dugmad **Potvrdi** i **Odbij**.
  Rešeno prikazuje poslednjih 30 dana, a starije je u Listi.
- **Kalendar** (2026-11-04), u stilu Google kalendara. Sadrži kod koga
  je dete i detetove aktivnosti.
  - **Prikazi:** Dan · Nedelja · Mesec · Raspored. Na telefonu je Nedelja
    3 dana. Strelice ‹ › pomeraju za dan, nedelju ili mesec. „Danas“ radi u
    svakom prikazu: vraća na danas i skroluje satnicu na trenutno vreme. Klik na
    dan u zaglavlju nedelje otvara taj dan. Izbor prikaza se pamti na uređaju.
  - **Kod koga je:** svaki dan je obojen bojom roditelja (tata tirkizna, mama
    ljubičasta, kao dve tačke u logou). Jednokratne promene su šrafirane.
  - **Prelazak:** kockica „⇄ 15:00 · Ide kod tate“ sa „ti preuzimaš“ ili
    „preuzima mama“, istaknuta kad preuzimaš ti. Naziv je izabran da govori šta
    se dešava detetu („ide kod tate“), a ne zvuči kao zapisnik („primopredaja“).
    Isto piše na vrhu kalendara, u rasporedu i na početnoj („Danas u 15:00 ide
    kod tate · ti preuzimaš“). U mesecu je to oznaka „⇄ 15:00“.
  - **Aktivnosti:** trening, rođendan, škola, lekar, ostalo, svaka sa svojom
    bojom koja se ne meša sa bojama roditelja. Aktivnost traje jedan dan (ceo dan
    ili od–do) i može da se ponavlja svake nedelje ili svake druge, izabranim
    danima, do datuma. Ima i polja „ko vodi“, mesto i napomenu. U nedelji i danu
    su aktivnosti blokovi na satnici, preklopljene dele širinu, a klik otvara
    detalje. Klik na prazno mesto predlaže aktivnost u to vreme. Stavke sa
    datumom stoje u redu „ceo dan“.
  - **Prevlačenje** („naravno svaka promena čeka potvrdu“):
    - aktivnost se prevlači na drugi dan ili sat (nedelja i dan) ili na drugi
      dan (mesec). Kod ponavljanja biraš „samo ovaj put“ (serija preskače taj
      dan, a umesto njega je jednokratna aktivnost) ili „svaki put“ (menja dan
      u nedelji i vreme serije);
    - kockica prelaska se vuče gore ili dole i tako predlaže drugo vreme tog
      dana. To je jednokratna promena za razliku u vremenu, a redovan raspored
      ostaje isti;
    - mišem odmah, prstom posle kratkog zadržavanja. Dok vučeš, isprekidan
      okvir pokazuje gde će aktivnost ili prelazak pasti i u koje vreme;
    - kad pustiš, iskoči „Bilo / Postaje“ sa porukom. Ništa se ne menja dok
      drugi roditelj ne prihvati.
  - **Niko ne menja kalendar sam.** Ovo važi za boravak i za aktivnosti.
    Dodavanje, izmena, brisanje i prevlačenje su zahtevi koje drugi roditelj
    prihvata. Dok to ne uradi, ništa se ne menja: predlog je isprekidan, a dan sa
    predlogom ima narandžast okvir. Predlagač ne može da prihvati svoj zahtev,
    samo da ga povuče. Odbijanje traži razlog. Sve ostaje u „Istoriji promena“.
  - **Boravak ima dva sloja:** redovan raspored (može da se ponavlja) i
    jednokratne promene, koje važe preko redovnog. Boravci istog sloja se ne
    preklapaju, a pri prihvatanju se to proverava ponovo.
  - Predlozi koji čekaju tebe ulaze u „Čeka tebe“ i „Na tebi je“ na početnoj.
- **Karton** (2026-11-04): stalni podaci o detetu.
  - Raspored: u zaglavlju su ime, uzrast i osnovni podaci (datum rođenja,
    puno ime). Ispod su **Škola · Zdravlje**, pa **Važni kontakti · Mere i
    veličine**, pa preko cele širine **Raspored časova** i **Drugari**.
    **Vanškolske aktivnosti** su na dnu, preko cele širine, kao
    kartice jedna pored druge. Svaka aktivnost pokazuje i „U kalendaru: …“ ako
    u kalendaru postoji aktivnost istog imena. Posebna strana za aktivnosti nije
    pravljena: donja traka na telefonu već ima pet ikonica, a termini su u
    kalendaru.
  - Grupe sa pojedinačnim podacima: Škola, Zdravlje, Mere i veličine, Osnovno.
    U Školi, Merama i Osnovnom aplikacija nudi polja koja fale kao dugmiće
    („+ Visina“). **Zdravlje** (2026-11-04) ima samo „+ Dodaj“, a
    predlozi (Pedijatar, Alergije, Vakcine…) se nude tek dok se kuca naziv.
  - **Škola** ima i spisak **Nastavnici** (ime, predmet ili uloga, kontakt,
    napomena) sa „+ Dodaj nastavnika“, koliko god treba. Ranije polje
    „Učitelj(ica)“ je ukinuto.
  - **Raspored časova** je posebna kartica (2026-11-04). Može se:
    - upisati ručno u tabelu dani × časovi, uz dodavanje i skidanje časova i
      napomenu (npr. smene);
    - uvesti iz Excela (.xlsx, prvi list) ili CSV-a. Prepoznaju se separatori
      `;` i `,`, dani latinicom, ćirilicom ili na engleskom, dani u kolonama ili
      u redovima, i časovi kao „1.“ ili „8:00–8:45“. Pre čuvanja se uvezena
      tabela pregleda i ispravlja. Excel se čita bez dodatne biblioteke;
    - slikati ili otpremiti kao slika, koja se pre čuvanja smanjuje i otvara
      se uvećana.
    Na računaru je cela tabela sa istaknutim današnjim danom. Na telefonu su
    dugmići za dane i spisak časova tog dana. Promene ulaze u „Promene u
    kartonu“. U bazi slika ide u privatno skladište (kao dokumenti), a ne u
    tabelu.
  - **Drugari** (2026-11-04): drugar ili drugarica, roditelj, telefon
    roditelja (klik poziva) i napomena.
  - Grupe-spiskovi: **Vanškolske aktivnosti** i **Važni kontakti**. Može ih biti
    koliko god treba. Svaka aktivnost je kartica sa svojim terminima, mestom,
    trenerom ili kontaktom i napomenom, a svaki kontakt ima telefon i napomenu.
  - Oba roditelja menjaju direktno, bez potvrde, ali svaka promena pamti ko,
    kada, staro i novo („Promene u kartonu“). Drugi roditelj je vidi na
    početnoj pod „Novo“.
  - Dok je jedna izmena otvorena, ostala dugmad su zaključana, da se otkucano ne
    izgubi.
  - Iz datuma rođenja se računa uzrast.
- **Istorija dogovora** (2026-11-04: pripada stavkama, ne kartonu):
  treći prikaz na ekranu Stavke (Tabla · Lista · Istorija). Sadrži sve zatvorene
  stavke sa dogovorom, po mesecima i najnovije prve, sa pitanjem ko je pitao i
  ko je potvrdio. Ima filter po oblasti, pretragu i izvoz CSV. „Starije rešene“
  sa table vodi ovde.
- **Dokumenti** (2026-11-04: posebna strana pored Kartona; urađeno
  istog dana): potvrde, nalazi, računi, skenovi. Kartice sa sličicom, nazivom,
  kategorijom i datumom; pretraga i filter po kategoriji (Škola, Zdravlje,
  Vanškolske, Lična dokumenta, Pravno i dogovori, Računi, Ostalo). Dodavanje:
  na telefonu „Slikaj“ ili izbor fajla, na računaru i prevlačenje. Pregled:
  slika ili PDF u aplikaciji (na telefonu PDF u novoj kartici), Otvori, Preuzmi,
  Izmeni, Obriši, i trag ko je šta uradio. Obrisani čekaju u odeljku
  „Obrisani“, odakle ih svako od vas vraća. Dokument koji je drugi roditelj
  dodao od tvoje poslednje posete ima oznaku „novo“.
- **Profil roditelja** (2026-11-04; migracija
  `20261104040000_profil_roditelja.sql`): u Podešavanjima (kružić sa slovom
  gore desno, i u demou) svako uređuje svoj profil: ime i prezime, telefon,
  adresa (gde je dete kod tebe, za primopredaju), mejl za kontakt i napomena
  (npr. radno vreme). Drugi roditelj to vidi; telefon je link za poziv, adresa
  otvara mapu, mejl otvara poštu. U bazi su to kolone u `roditelj`, a menjaju se
  samo kroz `sacuvaj_profil`, koja dira isključivo tvoj red. Uloge Tata/Mama i
  njihovi padeži ostaju fiksni.
- **Navigacija:** Početna · Stavke · Kalendar · Karton · Dokumenti. Na telefonu
  su to ikonice u donjoj traci, kao u aplikacijama, a gore ostaju logo i
  „+ Nova“. Na računaru je sve u gornjoj traci.
- **Stavke: Lista**: filteri po stanju, oblasti, oznaci i „čeka mene“; pretraga;
  izvoz CSV. Prekidač Tabla/Lista pamti izbor na uređaju.
- **Stavka**: opis, odgovori po vremenu, istorija izmena, dugmad Odgovori,
  Predloži zatvaranje, Potvrdi zatvaranje i Ponovo otvori.
- **Nova stavka**: naslov, oblast, oznake, rok (opciono), opis. Na telefonu treba
  da traje manje od pola minuta.
- **Prijava**: dugme „Prijavi se preko Google-a“, a ispod njega link na mejl.
  Nema lozinke.

## 6. Podaci i tehnika (preporuka)

**Baza: Supabase (Postgres) u EU regionu (Frankfurt), besplatni plan.**

- **Prijava** (2026-11-04): preko Google-a ili mejlom i lozinkom (bar
  10 znakova, slova i brojevi; mejl se potvrđuje linkom; postoji „zaboravljena
  lozinka“). Korisničko ime je mejl. Posebno korisničko ime nije uvedeno: bez
  mejla nema vraćanja lozinke, a prijava korisničkim imenom traži da se negde
  otkriva kom mejlu ono pripada.
- **MFA**: kod iz aplikacije (TOTP: Google Authenticator, Authy, 1Password).
  Uključuje se u podešavanjima ili pri prvom ulasku (preporučeno, ne obavezno).
  Kad je uključen, i baza traži drugi korak: restriktivna RLS politika pušta
  podatke tek na nivou `aal2`.
- **Porodični prostor i pozivnica** umesto liste od dve dozvoljene adrese:
  - prvi roditelj pravi prostor (ime deteta, tata ili mama) i dobija link za
    poziv, koji šalje Viberom, WhatsApp-om, mejlom ili kopiranjem;
  - link važi 7 dana i koristi se jednom; po želji je vezan za jedan mejl. U
    bazi se čuva samo SHA-256 otisak tokena, a novi link poništava stari;
  - drugi roditelj otvara link i vidi „Tata te poziva u zajednički prostor za vaše dete“,
    pravi nalog ili se prijavljuje, pa prihvata;
  - u prostoru mogu biti samo dvoje, a jedan nalog je u samo jednom prostoru;
  - registracija je otvorena, ali bez prostora nalog ne vidi ništa. Time
    aplikacija može da služi i drugim porodicama, svaka u svom prostoru.
- Tabele `porodica`, `roditelj`, `dete` i `pozivnica` nemaju politike za upis;
  sve ide kroz funkcije u bazi (`kreiraj_porodicu`, `napravi_pozivnicu`,
  `pogledaj_pozivnicu`, `prihvati_pozivnicu`, `oznaci_posetu`), koje proveravaju
  ko pita. Testovi: `supabase/tests/porodica.test.sql` (24 provere).
- **Google** je podešen u `supabase/config.toml`, ali isključen dok vlasnik ne
  napravi OAuth klijent u Google Cloud Console (uputstvo u README).
- Row Level Security: sve je zabranjeno osim za ta dva naloga.
- Istoriju izmena puni okidač u bazi, tako da ne zavisi od aplikacije.
- Besplatan projekat se pauzira posle nedelju dana bez aktivnosti. Nedeljni
  automatski izvoz (dole) ga drži aktivnim.

**Frontend: Astro + TypeScript**, kao sajt. CSS tokeni se kopiraju sa sajta.
Pregledač razgovara sa bazom direktno preko `supabase-js`, pa nema posebnog servera.

**Nema sopstvenog backenda.** Ulogu backenda ima Supabase:

- pravila pristupa: RLS politike;
- poslovna pravila: ograničenja i okidači u bazi (prelazi stanja, istorija,
  potvrda zatvaranja);
- obaveštenja u F2: Supabase Edge Function. I ona radi kod Supabase-a, pa ni tada
  ne pokrećemo svoj server.

Sva logika je u SQL migracijama u repou (`supabase/migrations`).

**Hosting: GitHub Pages** (2026-11-03), adresa
`https://manse404.github.io/co-parenting-app/`. Cloudflare ostaje rezerva.
Workflow `.github/workflows/pages.yml` gradi sa `BASE_PATH=/<ime-repoa>`, pa
radi i za svaki fork.

**Otvoren kod, privatna kopija** (2026-11-04): repo je javan pod MIT
licencom, da svako može da podigne svoju kopiju (uputstvo u README). Kopija
vlasnika je samo za njegovu porodicu: tabela `dozvoljeni_osnivac` (migracija
`20261104060000_ko_otvara_prostor.sql`) dozvoljava otvaranje prostora samo
upisanim mejlovima; prazna tabela znači da svako može, pa tuđe kopije rade bez
podešavanja. Drugi roditelj uvek ulazi preko poziva. Ko ne sme da otvori
prostor, na dobrodošlici vidi objašnjenje i link ka repou.

- Sama stranica je javna na oba hostinga. Podatke štite prijava i RLS u bazi,
  a ne skrivena adresa.
- **GitHub Pages** je besplatan samo iz javnog repoa. Tada izvorni kod mora biti
  bez ličnih podataka. Pre objave:
  - demo podaci (`src/lib/mock/seed.ts`) dobijaju neutralno ime deteta;
  - ovaj plan se čisti od imena ili seli van repoa;
  - pravo ime i nazivi oblasti stoje samo u bazi, a aplikacija ih tako već i čita.
- **Cloudflare** (Workers static assets ili Pages) radi iz privatnog repoa, pa
  ovakvo čišćenje nije potrebno. Takođe je besplatan.

**Kako se GitHub Pages povezuje sa Supabase-om.** GitHub Pages servira samo
fajlove. Aplikacija se učita u pregledač i odatle preko `supabase-js` razgovara
direktno sa Supabase-om preko HTTPS-a. Server između njih ne postoji. Pri
objavi treba:

- u Supabase-u (Auth → URL Configuration) za Site URL i Redirect URLs upisati
  `https://manse404.github.io/co-parenting-app/`, i lokalnu adresu za razvoj;
- u Google OAuth klijentu kao redirect URI upisati Supabase callback adresu
  (`https://<projekat>.supabase.co/auth/v1/callback`);
- Supabase URL i publishable ključ upisati u GitHub Actions varijable, iz kojih
  ulaze u build. Ti podaci su javni po dizajnu, jer ih vidi svaki pregledač.
  Supabase dokumentacija to izričito dozvoljava, pošto podatke štiti RLS;
- deploy preko GitHub Actions, isto kao za sajt.

Napomena: aplikacija deli domen `manse404.github.io` sa sajtom, pa sesija
prijave u pregledaču pripada istom domenu. To je u redu dok sajt nema skripte
trećih strana; danas ih nema. Ako ih ikad dobije, aplikacija prelazi na sopstveni
poddomen.

**Šta treba (sve besplatno):**

| Šta | Ko | Napomena |
|---|---|---|
| Supabase nalog i projekat, region Frankfurt | vlasnik pravi | |
| Google Cloud projekat sa OAuth klijentom | vlasnik pravi | samo za „Login with Google“; osnovni podaci (mejl, ime) ne traže verifikaciju od Google-a |
| Cloudflare nalog povezan sa GitHub-om | vlasnik | |
| Privatni GitHub repo | vlasnik | |
| Node 20+, Supabase CLI, Docker | lokalno | lokalna baza za razvoj i migracije |
| Domen | ne treba za v1 | adresa `*.workers.dev` / `*.pages.dev` je dovoljna; u F2 može zatrebati za slanje mejlova |

**„Sheet“:** dugme Izvezi (CSV/XLSX) na listi i nedeljni automatski izvoz preko
GitHub Action-a. Taj izvoz je ujedno i rezervna kopija.

Šema, prvi nacrt:

```
roditelj   id (auth korisnik), oznaka ('Tata' | 'Mama' ili ime),
           oznaka_akuzativ ('tatu' | 'mamu'), mejl, poslednja_poseta
dete       ime
oblast     kljuc, naziv, redosled   (naziv „Detetove potrebe“ živi samo ovde)
stavka     id, naslov, opis, oblast, stanje, vazno, hitno, datum,
           otvorio, odluka, zatvaranje_predlozio,
           kreirano, izmenjeno, zatvoreno
unos       id, stavka_id, autor, vrsta, tekst, kreirano
           vrsta: odgovor | aktivirano | predlog_zatvaranja | povucen_predlog |
                  odbijeno_zatvaranje | zatvoreno | ponovo_otvoreno
izmena     id, tabela, red_id, autor, staro (jsonb), novo (jsonb), vreme
```

Ko čeka koga ne čuva se posebno: izračunava se iz stanja, polja `otvorio` i
predloga zatvaranja (`src/lib/domen.ts`). Isto važi za automatsko Hitno.
`datum` je jedan datum, bilo da je rok ili termin.

Kalendar:

```
boravak            id, vrsta (redovno | izuzetak), kod (roditelj), od, do,
                   napomena, kreirano          — vreme je lokalno, bez zone
zahtev_kalendara   id, vrsta (dodaj | izmeni | obrisi), boravak_id,
                   boravci (jsonb: novi boravci), poruka, predlozio,
                   stanje (ceka | prihvacen | odbijen | povucen), razlog,
                   kreirano, reseno, resio
```

```
dogadjaj           id, naziv, vrsta, datum, ceo_dan, od, do,
                   ponavljanje (jsonb: tip, svakih, dani, do), izuzeti (date[]),
                   vodi, mesto, napomena, kreirano
```

`zahtev_kalendara` dobija `predmet` (boravak | dogadjaj), `dogadjaj_id`,
`dogadjaj` (jsonb) i `jednom` (datum pojave koja se pomera samo jednom).

Pravilo „niko sam“ sprovodi baza, ne samo aplikacija:

- `boravak` i `dogadjaj` nemaju politiku za INSERT, UPDATE i DELETE ni za
  jednog korisnika;
- roditelj sme samo da upiše `zahtev_kalendara` sa `predlozio = auth.uid()` i
  `stanje = 'ceka'`;
- jedina vrata ka tabeli `boravak` su funkcija `prihvati_zahtev(id)`
  (security definer). Ona proverava da prihvata drugi roditelj, ponovo proverava
  preklapanja i primenjuje izmenu u jednoj transakciji. `odbij_zahtev` i
  `povuci_zahtev` rade isto za svoje slučajeve.

Pravila su ista kao u `src/lib/kalendar.ts` i `src/lib/dogadjaji.ts`, sa
testovima u `kalendar.test.ts` i `dogadjaji.test.ts`.

Karton:

```
karton_unos        id, grupa, naziv, vrednost, detalji (jsonb, za spiskove),
                   izmenio, izmenjeno
                   grupe: osnovno, zdravlje, skola, nastavnici, mere,
                          kontakti, drugari, aktivnosti
raspored_casova    casovi (text[]), tabela (jsonb), slika (putanja u
                   skladištu), napomena, izmenio, izmenjeno
karton_izmena      id, unos_id, grupa, naziv, staro, novo, autor, kada
                   — puni je okidač u bazi, ne aplikacija
```

**Dokumenti (urađeno 2026-11-04, migracija `20261104020000_dokumenti.sql`).**
Prvi deo aplikacije koji u režimu sa bazom zaista deli podatke između vas dvoje:

- Supabase Storage, **privatna** kanta `dokumenti`, fajl pod
  `<porodica>/<dokument>.<ext>`. Javnih linkova nema; slika ili PDF se otvara
  potpisanim linkom koji važi 10 minuta.
- Pravila na kanti: čitaju i otpremaju samo dva roditelja te porodice (uz MFA,
  kao svuda). Kanta nema pravilo za izmenu ni brisanje, pa **otpremljen fajl
  niko ne može da zameni ni uništi**. Kanta prima samo PDF, JPG, PNG i WebP,
  najviše 10 MB.
- Tabele:

  ```
  dokument        id, porodica_id, putanja, naziv, kategorija, datum,
                  napomena, tip, velicina, otpremio, otpremljeno,
                  obrisan, obrisao
  dokument_trag   dokument_id, vrsta (otpremljen | izmenjen | obrisan |
                  vracen), ko, kada
  ```

  U tabele se ne piše direktno, samo kroz funkcije `dodaj_dokument`,
  `izmeni_dokument`, `obrisi_dokument` i `vrati_dokument`. Tip i veličinu
  `dodaj_dokument` uzima iz samog otpremljenog fajla, ne od aplikacije.
- Brisanje je „meko“: označi dokument, zapiše ko i kada, a svako od vas ga
  vraća. Vremenskog ograničenja za vraćanje za sada nema; trajno brisanje
  (posle 30 dana, uz Edge Function koja briše i fajl) ostaje za kasnije.
- Slike se pre slanja smanjuju u pregledaču (duža ivica do 2400 px, JPEG) kad su
  veće od 1,5 MB. HEIC sa iPhone-a se pretvara u JPEG gde pregledač ume da ga
  otvori; Safari na iPhone-u ionako šalje JPEG.
- U demo režimu dokumenti stoje u IndexedDB-u pregledača, sa četiri primera
  nacrtana u pregledaču (nema pravih skenova u repou).
- **Trajno brisanje** (2026-11-04; migracija
  `20261104030000_trajno_brisanje.sql`): samo iz „Obrisani“ i samo kad se oba
  roditelja slože. Jedan predloži, drugi potvrdi ili odbije; predlagač ne može
  sam sebi da potvrdi i može da povuče predlog. Vraćanje dokumenta odgovara na
  otvoren predlog (predlagač ga time povlači, drugi odbija); posle potvrde
  vraćanja nema. Tek tada kanta dozvoljava brisanje fajla (pravilo za DELETE
  traži odobren predlog), aplikacija ga briše preko Storage API-ja, a
  `zavrsi_trajno_brisanje` uklanja red tek kad fajla stvarno nema (može da se
  ponovi ako veza pukne). Ostaje zapis u `dokument_brisanje`: naziv, ko je
  predložio, ko je potvrdio, kada. Predlog koji čeka tebe stoji i na početnoj
  pod „Na tebi je“. Porodica sa jednim roditeljem ne može trajno da briše.
- Za kasnije: veza dokumenta sa stavkom (npr. nalaz uz „Kontrola kod
  alergologa“) i sa kartonom. Čeka da i stavke pređu u bazu, inače bi veza
  pokazivala na podatke koji postoje samo na jednom uređaju.

Kasnije: `dogadjaj` (termini), `trosak`.

**Alternativa: Google Sheet + Apps Script.** Prednost je što se tabela otvara
direktno. Nedostaci: izmene u tabeli zaobilaze pravila aplikacije (stanja,
istoriju, potvrdu zatvaranja), aplikacija je sporija i teško ju je urediti tako
da liči na sajt. Zato je preporuka Supabase, uz izvoz u tabelu.

## 7. Faze

**Status 2026-11-04 (veče):** ekrani iz F1 rade (demo u pregledaču, sa nalozima u bazi):
početna (nov raspored, Hitno na vrhu), tabla sa prevlačenjem, lista sa filterima
i izvozom CSV, stavka sa tokom i svim prelazima, nova stavka, kalendar boravka
sa aktivnostima, prikazima Dan/Nedelja/Mesec/Raspored i prevlačenjem (sve
kao predlozi koje drugi roditelj prihvata), karton (aktivnosti i kontakti kao
spiskovi) i istorija dogovora kod stavki. Dokumenti imaju svoju stranu i čekaju
bazu.

**Dokumenti urađeni (2026-11-04):** u bazi i u demou; vidi odeljak 6.

**F0, deo 1 urađen (2026-11-04):** lokalni Supabase (`npm run baza`), prijava,
MFA, porodični prostor i pozivnica, sa testovima u bazi i u pregledaču
(`npm run test:baza`, `npm run smoke:nalog`).

**F0, deo 2 urađen (2026-11-04):** stavke, kalendar i karton su u bazi
(migracija `20261104050000_stavke_kalendar_karton.sql`), pa sa nalozima oba
roditelja vide iste podatke. Pravila su u bazi, ista kao u aplikaciji: zatvaranje
stavke potvrđuje drugi roditelj; kalendar (boravci i aktivnosti) se menja samo
kroz predlog koji prihvata drugi roditelj, uz ponovnu proveru preklapanja;
karton beleži svaku izmenu okidačem (staro, novo, ko). Tabele nemaju pravila za
pisanje, samo funkcije. Aplikacija čita preko `src/lib/izvor-supabase.ts`; bez
naloga (demo) i dalje radi na probnim podacima u pregledaču. Traka „probni
podaci“ je uklonjena. Nov porodični prostor počinje prazan.

Otvoreno posle F0: drugi roditelj vidi promene tek kad osveži stranu (bez
Realtime-a); Supabase vraća najviše 1000 redova po tabeli (`max_rows`), što je
dovoljno za godine rada, ali boravke treba jednom ograničiti na period;
obaveštenja (F2).

- **F0, postavka:** Astro projekat sa tokenima sa sajta, Supabase projekat,
  šema, RLS, okidač istorije, dva naloga, Cloudflare Pages.
- **F1, MVP:** početna, lista, stavka, nova stavka, prelazi stanja,
  Predstojeće, Novo od poslednje posete, PWA, izvoz CSV.
- **F2:** obaveštenja mejlom (Hitno odmah, ostalo jednom dnevno), dokumenti
  (odeljak 6).
- **F3 (opciono):** troškovi.

Napomena: bez obaveštenja se ovakva aplikacija lako zaboravi. Ako se posle F1
pokaže da je drugi roditelj ne otvara redovno, obaveštenja idu odmah.

## 8. Testovi

- RLS: treći nalog i neprijavljen korisnik ne vide ništa.
- Tabla: prevlačenje mišem i prstom (zadrži pa prevuci), brz pokret prstom ne
  pomera karticu, zabranjen potez ne menja ništa (`npm run smoke`).
- Prelazi stanja: odgovor drugog roditelja prebacuje stavku u Otvoreno;
  zatvaranje bez odluke se odbija; potvrda zatvaranja mora doći od drugog roditelja.
- Istorija: svaka izmena ima autora i vreme.
- Karton: izmena pamti staru i novu vrednost, ista vrednost se ne beleži,
  brisanje ostavlja trag; aktivnosti i kontakti primaju neograničeno zapisa;
  otvoren nacrt zaključava ostalo. Istorija dogovora sadrži samo zatvorene
  stavke.
- Kalendar: predlog ne menja kalendar; predlagač ne može da prihvati svoj
  zahtev; prihvatanje ponovo proverava preklapanja; ponavljanje ne „klizi“
  preko promene letnjeg/zimskog vremena; pojave aktivnosti (nedeljno, svake
  druge, do datuma, izuzeti dani); raspored blokova koji se preklapaju;
  pomeranje samo jednom i svaki put; pomeren prelazak kao jednokratna promena;
  posle prevlačenja otvara se tačno jedan prozor, na sredini; u bazi: korisnik
  ne može direktno da piše u `boravak` i `dogadjaj` (test RLS-a u F0).
- Dokumenti (`supabase/tests/dokumenti.test.sql`, 30 provera): otpremanje samo
  u folder svoje porodice; opis samo za fajl koji postoji, sa tipom i veličinom
  iz fajla; drugi roditelj vidi i otvara, stranac i neprijavljen ne; fajl se ne
  menja i ne briše; brisanje označi i zapiše ko, vraćanje radi, trag beleži sve;
  sa MFA bez koda nema ni čitanja ni otpremanja. U pregledaču
  (`npm run smoke:nalog`): tata dodaje, mama vidi sličicu i otvara preko
  potpisanog linka, briše, a tata vraća.

## 9. Odluke

**Ime deteta se ne prikazuje** (2026-11-04): svuda piše „dete“
(„Detetove potrebe“, „Kod koga je dete“, „Karton deteta“). Dobrodošlica više
ne pita za ime; baza i dalje ima polje `dete.ime` i upisuje „Dete“. Ime može da
se upiše samo kao podatak u kartonu („Puno ime“), ako ga roditelji sami dodaju.


Doneto 2026-11-03:

1. Stanja Neodgovoreno / Otvoreno / Zatvoreno znače ono što piše u odeljku 3.
2. Zatvaranje predlaže jedan roditelj, a potvrđuje drugi.
3. Baza je Supabase. Prijava preko Google naloga, link na mejl kao rezerva.
4. Dodaci: 1–3 u v1, 4 u v2, a 5–6 tek ako oba roditelja žele.
5. Oznake u aplikaciji su „Tata“ i „Mama“. To je polje u bazi i lako se menja.
6. Hosting je GitHub Pages (odeljak 6). Repo postaje javan tek posle čišćenja ličnih podataka.

Doneto kasnije, 2026-11-04: prijava (Google, mejl i lozinka), MFA i povezivanje
pozivnicom. Lista dozvoljenih adresa je otpala, pa mejl drugog roditelja više
nije potreban unapred.

Ostaje otvoreno:

- Google OAuth klijent (Google Cloud Console). Pravi ga vlasnik.
- Google Sheet: Odgovara i Sheet. Ako zatreba tabela za čitanje, kasnije
  se dodaje jednosmerna kopija Supabase → Sheet. Sheet nikad nije izvor podataka.
