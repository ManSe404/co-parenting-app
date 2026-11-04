-- Items, the custody calendar with activities, and the child's karton.
--
-- The rules are the same as in the app (src/lib/domen.ts, kalendar.ts,
-- dogadjaji.ts, karton.ts) and are enforced here:
-- - items: closing is proposed by one parent and confirmed by the other;
-- - calendar: nothing changes directly; a request takes effect only when the
--   other parent accepts it, and overlaps are checked again at that moment;
-- - karton: either parent edits; a trigger logs every change with the old and
--   the new value and who made it.
-- Nobody writes these tables directly: there are no write policies, only the
-- functions below, which check who is asking.
--
-- Parents appear in the data as their role ('tata' / 'mama') where the app
-- shows them (who has the child, who takes them), and as the account
-- (auth.users id) where it matters who acted (proposed, accepted, wrote).
-- Calendar times are wall-clock strings "YYYY-MM-DDTHH:mm" in one time zone,
-- compared byte-wise (collation "C").

create function public.moja_uloga()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select uloga from public.roditelj where korisnik = (select auth.uid())
$$;

revoke execute on function public.moja_uloga() from public, anon;
grant execute on function public.moja_uloga() to authenticated;

-- Common checks for "I am signed in (with MFA if I use it) and in a family".
create function public.moj_prostor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  moja uuid;
begin
  perform public.prijavljen_sa_mfa();
  moja := public.moja_porodica();
  if moja is null then
    raise exception 'Nisi u porodičnom prostoru.' using errcode = '42501';
  end if;
  return moja;
end
$$;

revoke execute on function public.moj_prostor() from public, anon, authenticated;

-- ===========================================================================
-- Items (stavke) and their threads
-- ===========================================================================

create table public.stavka (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  naslov text not null check (length(btrim(naslov)) between 1 and 200),
  opis text not null default '' check (length(opis) <= 4000),
  oblast text not null check (oblast in ('skola', 'zdravlje', 'vanskolske', 'potrebe', 'ostalo')),
  stanje text not null default 'neodgovoreno' check (stanje in ('neodgovoreno', 'otvoreno', 'zatvoreno')),
  vazno boolean not null default false,
  hitno boolean not null default false,
  datum date,
  otvorio uuid not null references auth.users (id) on delete restrict,
  odluka text check (length(odluka) <= 4000),
  zatvaranje_predlozio uuid references auth.users (id) on delete set null,
  kreirano timestamptz not null default now(),
  izmenjeno timestamptz not null default now(),
  zatvoreno timestamptz
);

create index stavka_porodica on public.stavka (porodica_id);

create table public.unos (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  stavka_id uuid not null references public.stavka (id) on delete cascade,
  autor uuid not null references auth.users (id) on delete restrict,
  vrsta text not null check (vrsta in ('odgovor', 'aktivirano', 'predlog_zatvaranja', 'povucen_predlog', 'odbijeno_zatvaranje', 'zatvoreno', 'ponovo_otvoreno')),
  tekst text not null default '' check (length(tekst) <= 4000),
  kreirano timestamptz not null default now()
);

create index unos_stavka on public.unos (stavka_id, kreirano);
create index unos_porodica on public.unos (porodica_id);

-- An item of your own family, locked for the change that follows.
create function public.moja_stavka(p_id uuid)
returns public.stavka
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka;
begin
  select * into s from public.stavka where id = p_id and porodica_id = public.moj_prostor() for update;
  if not found then
    raise exception 'Stavka ne postoji.' using errcode = 'P0002';
  end if;
  return s;
end
$$;

create function public.obavezno(p_tekst text, p_poruka text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if btrim(coalesce(p_tekst, '')) = '' then
    raise exception '%', p_poruka using errcode = '22023';
  end if;
  return btrim(p_tekst);
end
$$;

revoke execute on function public.moja_stavka(uuid) from public, anon, authenticated;
revoke execute on function public.obavezno(text, text) from public, anon, authenticated;

create function public.nova_stavka(p_naslov text, p_opis text, p_oblast text, p_vazno boolean, p_hitno boolean, p_datum date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  moja uuid := public.moj_prostor();
  novi uuid;
begin
  insert into public.stavka (porodica_id, naslov, opis, oblast, vazno, hitno, datum, otvorio)
  values (moja, public.obavezno(p_naslov, 'Naslov je obavezan.'), btrim(coalesce(p_opis, '')), p_oblast,
          coalesce(p_vazno, false), coalesce(p_hitno, false), p_datum, (select auth.uid()))
  returning id into novi;
  return novi;
end
$$;

-- Changes only the fields present in p_izmena (naslov, opis, oblast, vazno, hitno, datum).
create function public.izmeni_stavku(p_id uuid, p_izmena jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
begin
  update public.stavka set
    naslov = case when p_izmena ? 'naslov' then public.obavezno(p_izmena ->> 'naslov', 'Naslov je obavezan.') else naslov end,
    opis = case when p_izmena ? 'opis' then btrim(coalesce(p_izmena ->> 'opis', '')) else opis end,
    oblast = case when p_izmena ? 'oblast' then p_izmena ->> 'oblast' else oblast end,
    vazno = case when p_izmena ? 'vazno' then (p_izmena ->> 'vazno')::boolean else vazno end,
    hitno = case when p_izmena ? 'hitno' then (p_izmena ->> 'hitno')::boolean else hitno end,
    datum = case when p_izmena ? 'datum' then nullif(p_izmena ->> 'datum', '')::date else datum end,
    izmenjeno = now()
  where id = s.id;
end
$$;

create function public.zapisi_unos(p_stavka public.stavka, p_vrsta text, p_tekst text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.unos (porodica_id, stavka_id, autor, vrsta, tekst)
  values (p_stavka.porodica_id, p_stavka.id, (select auth.uid()), p_vrsta, coalesce(p_tekst, ''))
$$;

revoke execute on function public.zapisi_unos(public.stavka, text, text) from public, anon, authenticated;

-- A reply from the other parent moves an unanswered item to open.
create function public.odgovori_na_stavku(p_id uuid, p_tekst text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
  t text;
begin
  if s.stanje = 'zatvoreno' then
    raise exception 'Zatvorena stavka se prvo ponovo otvara.' using errcode = '22023';
  end if;
  t := public.obavezno(p_tekst, 'Odgovor je prazan.');
  update public.stavka
  set stanje = case when s.stanje = 'neodgovoreno' and s.otvorio <> (select auth.uid()) then 'otvoreno' else s.stanje end,
      izmenjeno = now()
  where id = s.id;
  perform public.zapisi_unos(s, 'odgovor', t);
end
$$;

create function public.predlozi_zatvaranje(p_id uuid, p_odluka text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
  t text;
begin
  if s.stanje = 'zatvoreno' then
    raise exception 'Stavka je već zatvorena.' using errcode = '22023';
  end if;
  if s.zatvaranje_predlozio is not null then
    raise exception 'Zatvaranje je već predloženo.' using errcode = '22023';
  end if;
  t := public.obavezno(p_odluka, 'Upiši odluku pre zatvaranja.');
  -- A proposal from the parent who was asked is also an answer.
  update public.stavka
  set stanje = case when s.stanje = 'neodgovoreno' and s.otvorio <> (select auth.uid()) then 'otvoreno' else s.stanje end,
      odluka = t, zatvaranje_predlozio = (select auth.uid()), izmenjeno = now()
  where id = s.id;
  perform public.zapisi_unos(s, 'predlog_zatvaranja', t);
end
$$;

create function public.potvrdi_zatvaranje(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
begin
  if s.zatvaranje_predlozio is null then
    raise exception 'Zatvaranje nije predloženo.' using errcode = '22023';
  end if;
  if s.zatvaranje_predlozio = (select auth.uid()) then
    raise exception 'Zatvaranje potvrđuje drugi roditelj.' using errcode = '42501';
  end if;
  update public.stavka
  set stanje = 'zatvoreno', zatvaranje_predlozio = null, zatvoreno = now(), izmenjeno = now()
  where id = s.id;
  perform public.zapisi_unos(s, 'zatvoreno', s.odluka);
end
$$;

create function public.odbij_zatvaranje(p_id uuid, p_razlog text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
  t text;
begin
  if s.zatvaranje_predlozio is null then
    raise exception 'Zatvaranje nije predloženo.' using errcode = '22023';
  end if;
  if s.zatvaranje_predlozio = (select auth.uid()) then
    raise exception 'Svoj predlog možeš da povučeš.' using errcode = '42501';
  end if;
  t := public.obavezno(p_razlog, 'Napiši zašto se ne slažeš.');
  update public.stavka
  set odluka = null, zatvaranje_predlozio = null, stanje = 'otvoreno', izmenjeno = now()
  where id = s.id;
  perform public.zapisi_unos(s, 'odbijeno_zatvaranje', t);
end
$$;

-- p_u_aktivno: the board drop target was Aktivno, so the item lands there.
create function public.povuci_predlog_zatvaranja(p_id uuid, p_u_aktivno boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
begin
  if s.zatvaranje_predlozio is distinct from (select auth.uid()) then
    raise exception 'Možeš da povučeš samo svoj predlog.' using errcode = '42501';
  end if;
  update public.stavka
  set stanje = case when coalesce(p_u_aktivno, false) and s.stanje = 'neodgovoreno' then 'otvoreno' else s.stanje end,
      odluka = null, zatvaranje_predlozio = null, izmenjeno = now()
  where id = s.id;
  perform public.zapisi_unos(s, 'povucen_predlog', '');
end
$$;

create function public.aktiviraj_stavku(p_id uuid, p_napomena text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
begin
  if s.stanje <> 'neodgovoreno' then
    raise exception 'Stavka je već aktivna ili rešena.' using errcode = '22023';
  end if;
  if s.zatvaranje_predlozio is not null then
    raise exception 'Zatvaranje je predloženo; prvo ga potvrdite ili odbijte.' using errcode = '22023';
  end if;
  update public.stavka set stanje = 'otvoreno', izmenjeno = now() where id = s.id;
  perform public.zapisi_unos(s, 'aktivirano', btrim(coalesce(p_napomena, '')));
end
$$;

create function public.ponovo_otvori_stavku(p_id uuid, p_razlog text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
  t text;
begin
  if s.stanje <> 'zatvoreno' then
    raise exception 'Stavka nije zatvorena.' using errcode = '22023';
  end if;
  t := public.obavezno(p_razlog, 'Napiši zašto se stavka ponovo otvara.');
  update public.stavka set stanje = 'otvoreno', odluka = null, zatvoreno = null, izmenjeno = now() where id = s.id;
  perform public.zapisi_unos(s, 'ponovo_otvoreno', t);
end
$$;

-- ===========================================================================
-- Calendar: custody periods, activities, requests
-- ===========================================================================

create table public.boravak (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  vrsta text not null check (vrsta in ('redovno', 'izuzetak')),
  kod text not null check (kod in ('tata', 'mama')),
  pocetak text collate "C" not null check (pocetak ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  kraj text collate "C" not null check (kraj ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  napomena text not null default '' check (length(napomena) <= 500),
  kreirano timestamptz not null default now(),
  check (pocetak < kraj)
);

create index boravak_porodica on public.boravak (porodica_id, vrsta, pocetak);

create table public.dogadjaj (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  naziv text not null check (length(btrim(naziv)) between 1 and 120),
  vrsta text not null check (vrsta in ('trening', 'rodjendan', 'skola', 'lekar', 'ostalo')),
  datum date not null,
  ceo_dan boolean not null default false,
  pocetak text collate "C" not null default '' check (pocetak ~ '^(\d{2}:\d{2})?$'),
  kraj text collate "C" not null default '' check (kraj ~ '^(\d{2}:\d{2})?$'),
  ponavljanje jsonb not null default '{"tip": "ne"}',
  vodi text check (vodi in ('tata', 'mama')),
  mesto text not null default '' check (length(mesto) <= 200),
  napomena text not null default '' check (length(napomena) <= 1000),
  izuzeti date[] not null default '{}',
  kreirano timestamptz not null default now()
);

create index dogadjaj_porodica on public.dogadjaj (porodica_id);

create table public.zahtev_kalendara (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  predmet text not null default 'boravak' check (predmet in ('boravak', 'dogadjaj')),
  vrsta text not null check (vrsta in ('dodaj', 'izmeni', 'obrisi')),
  -- Targets are kept without a foreign key: the history outlives them.
  boravak_id uuid,
  boravci jsonb not null default '[]',
  dogadjaj_id uuid,
  dogadjaj jsonb,
  jednom date,
  poruka text not null default '' check (length(poruka) <= 1000),
  predlozio uuid not null references auth.users (id) on delete restrict,
  stanje text not null default 'ceka' check (stanje in ('ceka', 'prihvacen', 'odbijen', 'povucen')),
  razlog text,
  kreirano timestamptz not null default now(),
  reseno timestamptz,
  resio uuid references auth.users (id) on delete set null
);

create index zahtev_kalendara_porodica on public.zahtev_kalendara (porodica_id, kreirano);

-- The same checks as proveriBoravak in the app.
create function public.proveri_boravke(p_boravci jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  b jsonb;
begin
  if jsonb_typeof(p_boravci) <> 'array' then
    raise exception 'Neispravan predlog.' using errcode = '22023';
  end if;
  for b in select * from jsonb_array_elements(p_boravci) loop
    if coalesce(b ->> 'kod', '') not in ('tata', 'mama') then
      raise exception 'Izaberi kod koga je dete.' using errcode = '22023';
    end if;
    if coalesce(b ->> 'vrsta', '') not in ('redovno', 'izuzetak') then
      raise exception 'Neispravna vrsta boravka.' using errcode = '22023';
    end if;
    if coalesce(b ->> 'od', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' or coalesce(b ->> 'do', '') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$' then
      raise exception 'Upiši datum i vreme početka i kraja.' using errcode = '22023';
    end if;
    if (b ->> 'od') collate "C" >= (b ->> 'do') collate "C" then
      raise exception 'Kraj mora biti posle početka.' using errcode = '22023';
    end if;
    if length(coalesce(b ->> 'napomena', '')) > 500 then
      raise exception 'Napomena je preduga.' using errcode = '22023';
    end if;
  end loop;
end
$$;

-- Periods of the same layer may touch at a handover but never overlap.
-- Returns the first conflict as text, or null.
create function public.preklapanje_boravaka(p_porodica uuid, p_novi jsonb, p_izuzmi uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select opis from (
    select (n ->> 'od') || '–' || (n ->> 'do') || ' se preklapa sa ' || b.pocetak || '–' || b.kraj as opis
    from jsonb_array_elements(p_novi) n
    join public.boravak b
      on b.porodica_id = p_porodica
     and b.vrsta = n ->> 'vrsta'
     and (p_izuzmi is null or b.id <> p_izuzmi)
     and (n ->> 'od') collate "C" < b.kraj
     and b.pocetak < (n ->> 'do') collate "C"
    union all
    select (a.n ->> 'od') || '–' || (a.n ->> 'do') || ' se preklapa sa ' || (c.m ->> 'od') || '–' || (c.m ->> 'do')
    from jsonb_array_elements(p_novi) with ordinality a (n, i)
    join jsonb_array_elements(p_novi) with ordinality c (m, j)
      on c.j > a.i
     and c.m ->> 'vrsta' = a.n ->> 'vrsta'
     and (a.n ->> 'od') collate "C" < (c.m ->> 'do') collate "C"
     and (c.m ->> 'od') collate "C" < (a.n ->> 'do') collate "C"
  ) sukobi
  limit 1
$$;

-- The same checks as proveriDogadjaj in the app.
create function public.proveri_dogadjaj(d jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  p jsonb := d -> 'ponavljanje';
begin
  if d is null or jsonb_typeof(d) <> 'object' then
    raise exception 'Nema podataka o aktivnosti.' using errcode = '22023';
  end if;
  if btrim(coalesce(d ->> 'naziv', '')) = '' then
    raise exception 'Upiši naziv aktivnosti.' using errcode = '22023';
  end if;
  if coalesce(d ->> 'vrsta', '') not in ('trening', 'rodjendan', 'skola', 'lekar', 'ostalo') then
    raise exception 'Izaberi vrstu aktivnosti.' using errcode = '22023';
  end if;
  if coalesce(d ->> 'datum', '') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Izaberi datum.' using errcode = '22023';
  end if;
  if not coalesce((d ->> 'ceoDan')::boolean, false) then
    if coalesce(d ->> 'od', '') !~ '^\d{2}:\d{2}$' or coalesce(d ->> 'do', '') !~ '^\d{2}:\d{2}$' then
      raise exception 'Upiši vreme početka i kraja.' using errcode = '22023';
    end if;
    if (d ->> 'od') collate "C" >= (d ->> 'do') collate "C" then
      raise exception 'Kraj mora biti posle početka.' using errcode = '22023';
    end if;
  end if;
  if d ->> 'vodi' is not null and d ->> 'vodi' not in ('tata', 'mama') then
    raise exception 'Nepoznat roditelj.' using errcode = '22023';
  end if;
  if p is null or coalesce(p ->> 'tip', '') not in ('ne', 'nedeljno') then
    raise exception 'Neispravno ponavljanje.' using errcode = '22023';
  end if;
  if p ->> 'tip' = 'nedeljno' then
    if coalesce(p ->> 'svakih', '') not in ('1', '2') then
      raise exception 'Neispravno ponavljanje.' using errcode = '22023';
    end if;
    if jsonb_typeof(p -> 'dani') <> 'array' or jsonb_array_length(p -> 'dani') = 0 then
      raise exception 'Izaberi dane u nedelji.' using errcode = '22023';
    end if;
    if p ->> 'do' is not null and (p ->> 'do') collate "C" < (d ->> 'datum') collate "C" then
      raise exception 'Ponavljanje mora da traje bar do prvog dana.' using errcode = '22023';
    end if;
  end if;
end
$$;

revoke execute on function public.proveri_boravke(jsonb) from public, anon, authenticated;
revoke execute on function public.preklapanje_boravaka(uuid, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.proveri_dogadjaj(jsonb) from public, anon, authenticated;

-- Activity fields from the app's shape (od/do/ceoDan/izuzeti) to the row.
create function public.upisi_dogadjaj(p_porodica uuid, p_id uuid, d jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.dogadjaj (id, porodica_id, naziv, vrsta, datum, ceo_dan, pocetak, kraj, ponavljanje, vodi, mesto, napomena, izuzeti)
  values (
    p_id, p_porodica, btrim(d ->> 'naziv'), d ->> 'vrsta', (d ->> 'datum')::date, coalesce((d ->> 'ceoDan')::boolean, false),
    coalesce(d ->> 'od', ''), coalesce(d ->> 'do', ''), d -> 'ponavljanje', d ->> 'vodi',
    btrim(coalesce(d ->> 'mesto', '')), btrim(coalesce(d ->> 'napomena', '')),
    coalesce(array(select jsonb_array_elements_text(coalesce(d -> 'izuzeti', '[]'::jsonb)))::date[], '{}')
  )
  on conflict (id) do update set
    naziv = excluded.naziv, vrsta = excluded.vrsta, datum = excluded.datum, ceo_dan = excluded.ceo_dan,
    pocetak = excluded.pocetak, kraj = excluded.kraj, ponavljanje = excluded.ponavljanje, vodi = excluded.vodi,
    mesto = excluded.mesto, napomena = excluded.napomena, izuzeti = excluded.izuzeti, kreirano = now()
$$;

revoke execute on function public.upisi_dogadjaj(uuid, uuid, jsonb) from public, anon, authenticated;

create function public.predlozi_kalendar(p_vrsta text, p_boravak_id uuid, p_boravci jsonb, p_poruka text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  moja uuid := public.moj_prostor();
  n int := jsonb_array_length(coalesce(p_boravci, '[]'::jsonb));
  sukob text;
  novi uuid;
begin
  if p_vrsta not in ('dodaj', 'izmeni', 'obrisi') then
    raise exception 'Neispravan predlog.' using errcode = '22023';
  end if;
  if p_vrsta = 'dodaj' and n = 0 then
    raise exception 'Nema šta da se doda.' using errcode = '22023';
  end if;
  if p_vrsta = 'izmeni' and n <> 1 then
    raise exception 'Izmena menja tačno jedan boravak.' using errcode = '22023';
  end if;
  if p_vrsta = 'obrisi' and n > 0 then
    raise exception 'Brisanje ne dodaje boravke.' using errcode = '22023';
  end if;
  if p_vrsta <> 'dodaj' and not exists (select 1 from public.boravak where id = p_boravak_id and porodica_id = moja) then
    raise exception 'Taj boravak više ne postoji.' using errcode = 'P0002';
  end if;
  if n > 400 then
    raise exception 'Predlog je prevelik.' using errcode = '22023';
  end if;
  perform public.proveri_boravke(coalesce(p_boravci, '[]'::jsonb));
  sukob := public.preklapanje_boravaka(moja, coalesce(p_boravci, '[]'::jsonb), case when p_vrsta = 'izmeni' then p_boravak_id end);
  if sukob is not null then
    raise exception 'Preklapa se sa postojećim rasporedom: %.', sukob using errcode = '22023';
  end if;

  insert into public.zahtev_kalendara (porodica_id, predmet, vrsta, boravak_id, boravci, poruka, predlozio)
  values (
    moja, 'boravak', p_vrsta, case when p_vrsta = 'dodaj' then null else p_boravak_id end,
    (select coalesce(jsonb_agg(b || jsonb_build_object('napomena', btrim(coalesce(b ->> 'napomena', '')))), '[]'::jsonb)
     from jsonb_array_elements(coalesce(p_boravci, '[]'::jsonb)) b),
    btrim(coalesce(p_poruka, '')), (select auth.uid())
  )
  returning id into novi;
  return novi;
end
$$;

create function public.predlozi_dogadjaj(p_vrsta text, p_dogadjaj_id uuid, p_dogadjaj jsonb, p_poruka text, p_jednom date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  moja uuid := public.moj_prostor();
  novi uuid;
begin
  if p_vrsta not in ('dodaj', 'izmeni', 'obrisi') then
    raise exception 'Neispravan predlog.' using errcode = '22023';
  end if;
  if p_vrsta <> 'dodaj' and not exists (select 1 from public.dogadjaj where id = p_dogadjaj_id and porodica_id = moja) then
    raise exception 'Ta aktivnost više ne postoji.' using errcode = 'P0002';
  end if;
  if p_vrsta <> 'obrisi' then
    perform public.proveri_dogadjaj(p_dogadjaj);
  end if;
  if p_jednom is not null and p_vrsta <> 'izmeni' then
    raise exception '„Samo jednom“ važi samo za pomeranje.' using errcode = '22023';
  end if;

  insert into public.zahtev_kalendara (porodica_id, predmet, vrsta, dogadjaj_id, dogadjaj, jednom, poruka, predlozio)
  values (
    moja, 'dogadjaj', p_vrsta, case when p_vrsta = 'dodaj' then null else p_dogadjaj_id end,
    case when p_vrsta = 'obrisi' then null
         else p_dogadjaj || jsonb_build_object(
           'naziv', btrim(p_dogadjaj ->> 'naziv'),
           'mesto', btrim(coalesce(p_dogadjaj ->> 'mesto', '')),
           'napomena', btrim(coalesce(p_dogadjaj ->> 'napomena', '')))
    end,
    p_jednom, btrim(coalesce(p_poruka, '')), (select auth.uid())
  )
  returning id into novi;
  return novi;
end
$$;

-- A request of your own family, locked.
create function public.moj_zahtev(p_id uuid)
returns public.zahtev_kalendara
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.zahtev_kalendara;
begin
  select * into z from public.zahtev_kalendara where id = p_id and porodica_id = public.moj_prostor() for update;
  if not found then
    raise exception 'Zahtev ne postoji.' using errcode = 'P0002';
  end if;
  return z;
end
$$;

revoke execute on function public.moj_zahtev(uuid) from public, anon, authenticated;

-- The other parent accepts: the change is applied in one step.
create function public.prihvati_zahtev(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.zahtev_kalendara := public.moj_zahtev(p_id);
  ja uuid := (select auth.uid());
  sukob text;
begin
  if z.stanje <> 'ceka' then
    raise exception 'Zahtev je već rešen.' using errcode = '22023';
  end if;
  if z.predlozio = ja then
    raise exception 'Zahtev prihvata drugi roditelj.' using errcode = '42501';
  end if;

  if z.predmet = 'dogadjaj' then
    if z.vrsta <> 'dodaj' and not exists (select 1 from public.dogadjaj where id = z.dogadjaj_id and porodica_id = z.porodica_id) then
      raise exception 'Ta aktivnost više ne postoji.' using errcode = 'P0002';
    end if;
    if z.jednom is not null and z.dogadjaj is not null then
      -- Just this once: the series skips that day, and a one-off takes its place.
      update public.dogadjaj
      set izuzeti = case when z.jednom = any (izuzeti) then izuzeti else array_append(izuzeti, z.jednom) end
      where id = z.dogadjaj_id;
      perform public.upisi_dogadjaj(z.porodica_id, gen_random_uuid(), z.dogadjaj);
    elsif z.vrsta = 'obrisi' then
      delete from public.dogadjaj where id = z.dogadjaj_id;
    elsif z.vrsta = 'izmeni' then
      -- A change keeps the id, so links and history stay attached to it.
      perform public.upisi_dogadjaj(z.porodica_id, z.dogadjaj_id, z.dogadjaj);
    else
      perform public.upisi_dogadjaj(z.porodica_id, gen_random_uuid(), z.dogadjaj);
    end if;
  else
    if z.vrsta <> 'dodaj' then
      if not exists (select 1 from public.boravak where id = z.boravak_id and porodica_id = z.porodica_id) then
        raise exception 'Taj boravak više ne postoji.' using errcode = 'P0002';
      end if;
      delete from public.boravak where id = z.boravak_id;
    end if;
    -- Check again: the calendar may have changed since the request was made.
    sukob := public.preklapanje_boravaka(z.porodica_id, z.boravci, null);
    if sukob is not null then
      raise exception 'Ne može: %. Neka se predloži ponovo.', sukob using errcode = '22023';
    end if;
    insert into public.boravak (porodica_id, vrsta, kod, pocetak, kraj, napomena)
    select z.porodica_id, b ->> 'vrsta', b ->> 'kod', b ->> 'od', b ->> 'do', coalesce(b ->> 'napomena', '')
    from jsonb_array_elements(z.boravci) b;
  end if;

  update public.zahtev_kalendara set stanje = 'prihvacen', reseno = now(), resio = ja where id = z.id;
end
$$;

create function public.odbij_zahtev(p_id uuid, p_razlog text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.zahtev_kalendara := public.moj_zahtev(p_id);
  t text;
begin
  if z.stanje <> 'ceka' then
    raise exception 'Zahtev je već rešen.' using errcode = '22023';
  end if;
  if z.predlozio = (select auth.uid()) then
    raise exception 'Svoj zahtev možeš da povučeš.' using errcode = '42501';
  end if;
  t := public.obavezno(p_razlog, 'Napiši zašto ne prihvataš.');
  update public.zahtev_kalendara set stanje = 'odbijen', razlog = t, reseno = now(), resio = (select auth.uid()) where id = z.id;
end
$$;

create function public.povuci_zahtev(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  z public.zahtev_kalendara := public.moj_zahtev(p_id);
begin
  if z.stanje <> 'ceka' then
    raise exception 'Zahtev je već rešen.' using errcode = '22023';
  end if;
  if z.predlozio <> (select auth.uid()) then
    raise exception 'Možeš da povučeš samo svoj zahtev.' using errcode = '42501';
  end if;
  update public.zahtev_kalendara set stanje = 'povucen', reseno = now(), resio = (select auth.uid()) where id = z.id;
end
$$;

-- ===========================================================================
-- Karton: fields and lists, the school timetable, and the change log
-- ===========================================================================

create table public.karton_unos (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  grupa text not null check (grupa in ('osnovno', 'zdravlje', 'skola', 'nastavnici', 'aktivnosti', 'mere', 'kontakti', 'drugari')),
  naziv text not null check (length(btrim(naziv)) between 1 and 120),
  vrednost text not null default '' check (length(vrednost) <= 4000),
  detalji jsonb,
  izmenio uuid references auth.users (id) on delete set null,
  izmenjeno timestamptz not null default now()
);

create index karton_unos_porodica on public.karton_unos (porodica_id);

create table public.raspored_casova (
  porodica_id uuid primary key references public.porodica (id) on delete cascade,
  casovi jsonb not null default '[]',
  tabela jsonb not null default '[]',
  -- A shrunk photo as a data URL (the app makes it about 100–300 KB).
  slika text check (slika is null or (slika like 'data:image/%' and length(slika) <= 3000000)),
  napomena text not null default '' check (length(napomena) <= 1000),
  izmenio uuid references auth.users (id) on delete set null,
  izmenjeno timestamptz not null default now()
);

-- Filled only by the triggers below. staro/novo are snapshots of the entry;
-- the app turns them into one-line summaries.
create table public.karton_izmena (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  -- A karton_unos id, or 'raspored-casova'.
  unos_id text not null,
  grupa text not null,
  naziv text not null,
  staro jsonb,
  novo jsonb,
  autor uuid references auth.users (id) on delete set null,
  kada timestamptz not null default now()
);

create index karton_izmena_porodica on public.karton_izmena (porodica_id, kada);

create function public.zabelezi_karton()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snimak_staro jsonb;
  snimak_novo jsonb;
begin
  if tg_op <> 'INSERT' then
    snimak_staro := jsonb_build_object('grupa', old.grupa, 'naziv', old.naziv, 'vrednost', old.vrednost, 'detalji', old.detalji);
  end if;
  if tg_op <> 'DELETE' then
    snimak_novo := jsonb_build_object('grupa', new.grupa, 'naziv', new.naziv, 'vrednost', new.vrednost, 'detalji', new.detalji);
  end if;
  if tg_op = 'UPDATE' and snimak_staro = snimak_novo then
    return new;
  end if;
  insert into public.karton_izmena (porodica_id, unos_id, grupa, naziv, staro, novo, autor)
  values (
    coalesce(new.porodica_id, old.porodica_id), coalesce(new.id, old.id)::text, coalesce(new.grupa, old.grupa),
    coalesce(new.naziv, old.naziv), snimak_staro, snimak_novo, (select auth.uid())
  );
  return coalesce(new, old);
end
$$;

create trigger karton_unos_istorija
after insert or update or delete on public.karton_unos
for each row execute function public.zabelezi_karton();

create function public.zabelezi_raspored()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snimak_staro jsonb;
  snimak_novo jsonb;
begin
  if tg_op <> 'INSERT' then
    snimak_staro := jsonb_build_object('casovi', old.casovi, 'tabela', old.tabela, 'slika', old.slika is not null, 'napomena', old.napomena);
  end if;
  if tg_op <> 'DELETE' then
    snimak_novo := jsonb_build_object('casovi', new.casovi, 'tabela', new.tabela, 'slika', new.slika is not null, 'napomena', new.napomena);
  end if;
  if tg_op = 'UPDATE' and snimak_staro = snimak_novo and old.slika is not distinct from new.slika then
    return new;
  end if;
  insert into public.karton_izmena (porodica_id, unos_id, grupa, naziv, staro, novo, autor)
  values (coalesce(new.porodica_id, old.porodica_id), 'raspored-casova', 'skola', 'Raspored časova', snimak_staro, snimak_novo, (select auth.uid()));
  return coalesce(new, old);
end
$$;

create trigger raspored_casova_istorija
after insert or update or delete on public.raspored_casova
for each row execute function public.zabelezi_raspored();

revoke execute on function public.zabelezi_karton() from public, anon, authenticated;
revoke execute on function public.zabelezi_raspored() from public, anon, authenticated;

-- Saves a field (or a list record); p_id null adds a new one.
create function public.sacuvaj_karton(p_id uuid, p_grupa text, p_naziv text, p_vrednost text, p_detalji jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  moja uuid := public.moj_prostor();
  spisak boolean := p_grupa in ('nastavnici', 'aktivnosti', 'kontakti', 'drugari');
  v_naziv text := btrim(coalesce(p_naziv, ''));
  v_vrednost text := case when spisak then '' else btrim(coalesce(p_vrednost, '')) end;
  v_detalji jsonb := case when spisak then coalesce(p_detalji, '{}'::jsonb) end;
  novi uuid;
begin
  if p_grupa is null or p_grupa not in ('osnovno', 'zdravlje', 'skola', 'nastavnici', 'aktivnosti', 'mere', 'kontakti', 'drugari') then
    raise exception 'Nepoznata grupa kartona.' using errcode = '22023';
  end if;
  if v_naziv = '' then
    raise exception '%', case when spisak then 'Upiši naziv.' else 'Upiši naziv polja.' end using errcode = '22023';
  end if;
  if not spisak and v_vrednost = '' then
    raise exception 'Upiši vrednost; prazno polje se briše.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.karton_unos (porodica_id, grupa, naziv, vrednost, detalji, izmenio)
    values (moja, p_grupa, v_naziv, v_vrednost, v_detalji, (select auth.uid()))
    returning id into novi;
    return novi;
  end if;

  update public.karton_unos
  set naziv = v_naziv, vrednost = v_vrednost, detalji = v_detalji, izmenio = (select auth.uid()), izmenjeno = now()
  where id = p_id and porodica_id = moja
    and (karton_unos.naziv, karton_unos.vrednost, karton_unos.detalji) is distinct from (v_naziv, v_vrednost, v_detalji);
  if not found and not exists (select 1 from public.karton_unos where id = p_id and porodica_id = moja) then
    raise exception 'To polje više ne postoji.' using errcode = 'P0002';
  end if;
  return p_id;
end
$$;

create function public.obrisi_karton(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moja uuid := public.moj_prostor();
begin
  delete from public.karton_unos where id = p_id and porodica_id = moja;
  if not found then
    raise exception 'To polje više ne postoji.' using errcode = 'P0002';
  end if;
end
$$;

-- Saves the timetable; all arguments null removes it.
create function public.sacuvaj_raspored(p_casovi jsonb, p_tabela jsonb, p_slika text, p_napomena text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  moja uuid := public.moj_prostor();
begin
  if p_casovi is null and p_tabela is null and p_slika is null and p_napomena is null then
    delete from public.raspored_casova where porodica_id = moja;
    return;
  end if;
  if jsonb_typeof(coalesce(p_casovi, '[]'::jsonb)) <> 'array' or jsonb_typeof(coalesce(p_tabela, '[]'::jsonb)) <> 'array' then
    raise exception 'Neispravan raspored.' using errcode = '22023';
  end if;
  insert into public.raspored_casova (porodica_id, casovi, tabela, slika, napomena, izmenio, izmenjeno)
  values (moja, coalesce(p_casovi, '[]'::jsonb), coalesce(p_tabela, '[]'::jsonb), p_slika, btrim(coalesce(p_napomena, '')), (select auth.uid()), now())
  on conflict (porodica_id) do update set
    casovi = excluded.casovi, tabela = excluded.tabela, slika = excluded.slika, napomena = excluded.napomena,
    izmenio = excluded.izmenio, izmenjeno = excluded.izmenjeno;
end
$$;

-- ===========================================================================
-- Row level security: read your own family; MFA as everywhere; no writes
-- ===========================================================================

alter table public.stavka enable row level security;
alter table public.unos enable row level security;
alter table public.boravak enable row level security;
alter table public.dogadjaj enable row level security;
alter table public.zahtev_kalendara enable row level security;
alter table public.karton_unos enable row level security;
alter table public.raspored_casova enable row level security;
alter table public.karton_izmena enable row level security;

revoke insert, update, delete, truncate on
  public.stavka, public.unos, public.boravak, public.dogadjaj, public.zahtev_kalendara,
  public.karton_unos, public.raspored_casova, public.karton_izmena
from anon, authenticated;

create policy "clan cita stavke" on public.stavka for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa stavka" on public.stavka as restrictive for all to authenticated using ((select public.mfa_ispunjen()));
create policy "clan cita unose" on public.unos for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa unos" on public.unos as restrictive for all to authenticated using ((select public.mfa_ispunjen()));
create policy "clan cita boravke" on public.boravak for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa boravak" on public.boravak as restrictive for all to authenticated using ((select public.mfa_ispunjen()));
create policy "clan cita dogadjaje" on public.dogadjaj for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa dogadjaj" on public.dogadjaj as restrictive for all to authenticated using ((select public.mfa_ispunjen()));
create policy "clan cita zahteve" on public.zahtev_kalendara for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa zahtev_kalendara" on public.zahtev_kalendara as restrictive for all to authenticated using ((select public.mfa_ispunjen()));
create policy "clan cita karton" on public.karton_unos for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa karton_unos" on public.karton_unos as restrictive for all to authenticated using ((select public.mfa_ispunjen()));
create policy "clan cita raspored" on public.raspored_casova for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa raspored_casova" on public.raspored_casova as restrictive for all to authenticated using ((select public.mfa_ispunjen()));
create policy "clan cita istoriju kartona" on public.karton_izmena for select to authenticated using (porodica_id = (select public.moja_porodica()));
create policy "mfa karton_izmena" on public.karton_izmena as restrictive for all to authenticated using ((select public.mfa_ispunjen()));

-- ===========================================================================
-- Who may call what
-- ===========================================================================

do $$
declare
  f text;
begin
  foreach f in array array[
    'public.nova_stavka(text, text, text, boolean, boolean, date)',
    'public.izmeni_stavku(uuid, jsonb)',
    'public.odgovori_na_stavku(uuid, text)',
    'public.predlozi_zatvaranje(uuid, text)',
    'public.potvrdi_zatvaranje(uuid)',
    'public.odbij_zatvaranje(uuid, text)',
    'public.povuci_predlog_zatvaranja(uuid, boolean)',
    'public.aktiviraj_stavku(uuid, text)',
    'public.ponovo_otvori_stavku(uuid, text)',
    'public.predlozi_kalendar(text, uuid, jsonb, text)',
    'public.predlozi_dogadjaj(text, uuid, jsonb, text, date)',
    'public.prihvati_zahtev(uuid)',
    'public.odbij_zahtev(uuid, text)',
    'public.povuci_zahtev(uuid)',
    'public.sacuvaj_karton(uuid, text, text, text, jsonb)',
    'public.obrisi_karton(uuid)',
    'public.sacuvaj_raspored(jsonb, jsonb, text, text)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end
$$;
