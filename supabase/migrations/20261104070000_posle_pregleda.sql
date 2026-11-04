-- Tightening after the security review of 2026-11-04.
--
-- - An item that is closed, or whose closing waits for the other parent,
--   cannot be edited; every edit of an open item is written to its thread.
-- - Calendar requests keep only the fields the other parent is shown, and
--   "skipped days" of a series change only through "just this once".
-- - Dates and times must be real ones; one stay request is one layer.
-- - Size limits on what one parent can write, so one family cannot fill the
--   shared project.
-- - Documents: only the uploader registers a file, type must match the name,
--   uploads only under <family>/<uuid>.<ext>.
-- - Locks where two calls at the same moment could both pass a check.
-- - A used or expired invitation shows nothing about the family.

-- ===========================================================================
-- Shared checks
-- ===========================================================================

create function public.ispravan_datum(t text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if t is null or t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  perform t::date;
  return true;
exception when others then
  return false;
end
$$;

create function public.ispravno_vreme(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(t ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$', false)
$$;

-- "YYYY-MM-DDTHH:mm", a real day and time.
create function public.ispravan_trenutak(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(length(t) = 16 and substr(t, 11, 1) = 'T'
    and public.ispravan_datum(substr(t, 1, 10)) and public.ispravno_vreme(substr(t, 12, 5)), false)
$$;

create function public.naziv_oblasti(k text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case k
    when 'skola' then 'Škola'
    when 'zdravlje' then 'Zdravlje'
    when 'vanskolske' then 'Vanškolske aktivnosti'
    when 'potrebe' then 'Detetove potrebe'
    when 'ostalo' then 'Ostalo'
    else k
  end
$$;

-- "5. 11. 2026." or "bez roka"; the app writes the same.
create function public.rok_tekst(d date)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(to_char(d, 'FMDD. FMMM. YYYY.'), 'bez roka')
$$;

revoke execute on function public.ispravan_datum(text) from public, anon, authenticated;
revoke execute on function public.ispravno_vreme(text) from public, anon, authenticated;
revoke execute on function public.ispravan_trenutak(text) from public, anon, authenticated;
revoke execute on function public.naziv_oblasti(text) from public, anon, authenticated;
revoke execute on function public.rok_tekst(date) from public, anon, authenticated;

-- ===========================================================================
-- Items: no silent edits
-- ===========================================================================

alter table public.unos drop constraint unos_vrsta_check;
alter table public.unos add constraint unos_vrsta_check
  check (vrsta in ('odgovor', 'aktivirano', 'predlog_zatvaranja', 'povucen_predlog', 'odbijeno_zatvaranje', 'zatvoreno', 'ponovo_otvoreno', 'izmenjeno'));

-- Changes only the fields present in p_izmena (naslov, opis, oblast, vazno,
-- hitno, datum) and writes what changed into the item's thread. The same
-- wording as izmeni() in src/lib/domen.ts.
create or replace function public.izmeni_stavku(p_id uuid, p_izmena jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka := public.moja_stavka(p_id);
  n public.stavka := s;
  promene text[] := '{}';
begin
  if s.stanje = 'zatvoreno' then
    raise exception 'Rešena stavka se ne menja. Ako treba, ponovo je otvori.' using errcode = '22023';
  end if;
  if s.zatvaranje_predlozio is not null then
    raise exception 'Zatvaranje čeka potvrdu. Povuci ili odbij predlog, pa izmeni.' using errcode = '22023';
  end if;
  if p_izmena is null or jsonb_typeof(p_izmena) <> 'object' then
    raise exception 'Neispravna izmena.' using errcode = '22023';
  end if;

  if p_izmena ? 'naslov' then n.naslov := public.obavezno(p_izmena ->> 'naslov', 'Naslov je obavezan.'); end if;
  if p_izmena ? 'opis' then n.opis := btrim(coalesce(p_izmena ->> 'opis', '')); end if;
  if p_izmena ? 'oblast' then n.oblast := p_izmena ->> 'oblast'; end if;
  if p_izmena ? 'vazno' then n.vazno := coalesce((p_izmena ->> 'vazno')::boolean, false); end if;
  if p_izmena ? 'hitno' then n.hitno := coalesce((p_izmena ->> 'hitno')::boolean, false); end if;
  if p_izmena ? 'datum' then
    if nullif(p_izmena ->> 'datum', '') is not null and not public.ispravan_datum(p_izmena ->> 'datum') then
      raise exception 'Neispravan datum.' using errcode = '22023';
    end if;
    n.datum := nullif(p_izmena ->> 'datum', '')::date;
  end if;

  if n.naslov is distinct from s.naslov then
    promene := promene || format('Naslov: „%s“ → „%s“', s.naslov, n.naslov);
  end if;
  if n.oblast is distinct from s.oblast then
    promene := promene || format('Oblast: %s → %s', public.naziv_oblasti(s.oblast), public.naziv_oblasti(n.oblast));
  end if;
  if n.vazno is distinct from s.vazno then
    promene := promene || case when n.vazno then 'Označeno kao važno' else 'Više nije označeno kao važno' end;
  end if;
  if n.hitno is distinct from s.hitno then
    promene := promene || case when n.hitno then 'Označeno kao hitno' else 'Više nije označeno kao hitno' end;
  end if;
  if n.datum is distinct from s.datum then
    promene := promene || format('Rok: %s → %s', public.rok_tekst(s.datum), public.rok_tekst(n.datum));
  end if;
  if n.opis is distinct from s.opis then
    promene := promene || case
      when s.opis = '' then 'Dodat opis'
      else format('Opis izmenjen; ranije: „%s“', case when length(s.opis) > 1500 then left(s.opis, 1500) || '…' else s.opis end)
    end;
  end if;
  if cardinality(promene) = 0 then
    return;
  end if;

  update public.stavka set
    naslov = n.naslov, opis = n.opis, oblast = n.oblast, vazno = n.vazno, hitno = n.hitno, datum = n.datum,
    izmenjeno = now()
  where id = s.id;
  perform public.zapisi_unos(n, 'izmenjeno', array_to_string(promene, E'\n'));
end
$$;

-- ===========================================================================
-- Calendar: only shown fields, real dates, one layer per request
-- ===========================================================================

create or replace function public.proveri_boravke(p_boravci jsonb)
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
    if jsonb_typeof(b) <> 'object' then
      raise exception 'Neispravan predlog.' using errcode = '22023';
    end if;
    if coalesce(b ->> 'kod', '') not in ('tata', 'mama') then
      raise exception 'Izaberi kod koga je dete.' using errcode = '22023';
    end if;
    if coalesce(b ->> 'vrsta', '') not in ('redovno', 'izuzetak') then
      raise exception 'Neispravna vrsta boravka.' using errcode = '22023';
    end if;
    if not public.ispravan_trenutak(b ->> 'od') or not public.ispravan_trenutak(b ->> 'do') then
      raise exception 'Upiši datum i vreme početka i kraja.' using errcode = '22023';
    end if;
    if (b ->> 'od') collate "C" >= (b ->> 'do') collate "C" then
      raise exception 'Kraj mora biti posle početka.' using errcode = '22023';
    end if;
    if length(coalesce(b ->> 'napomena', '')) > 500 then
      raise exception 'Napomena je preduga.' using errcode = '22023';
    end if;
  end loop;
  if (select count(distinct e ->> 'vrsta') from jsonb_array_elements(p_boravci) e) > 1 then
    raise exception 'Redovan raspored i jednokratne promene predlažu se posebno.' using errcode = '22023';
  end if;
end
$$;

create or replace function public.proveri_dogadjaj(d jsonb)
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
  if length(btrim(d ->> 'naziv')) > 120 then
    raise exception 'Naziv je predugačak (najviše 120 znakova).' using errcode = '22023';
  end if;
  if coalesce(d ->> 'vrsta', '') not in ('trening', 'rodjendan', 'skola', 'lekar', 'ostalo') then
    raise exception 'Izaberi vrstu aktivnosti.' using errcode = '22023';
  end if;
  if not public.ispravan_datum(d ->> 'datum') then
    raise exception 'Izaberi datum.' using errcode = '22023';
  end if;
  if not coalesce((d ->> 'ceoDan')::boolean, false) then
    if not public.ispravno_vreme(d ->> 'od') or not public.ispravno_vreme(d ->> 'do') then
      raise exception 'Upiši vreme početka i kraja.' using errcode = '22023';
    end if;
    if (d ->> 'od') collate "C" >= (d ->> 'do') collate "C" then
      raise exception 'Kraj mora biti posle početka.' using errcode = '22023';
    end if;
  end if;
  if d ->> 'vodi' is not null and d ->> 'vodi' not in ('tata', 'mama') then
    raise exception 'Nepoznat roditelj.' using errcode = '22023';
  end if;
  if length(coalesce(d ->> 'mesto', '')) > 200 then
    raise exception 'Mesto je predugačko (najviše 200 znakova).' using errcode = '22023';
  end if;
  if length(coalesce(d ->> 'napomena', '')) > 1000 then
    raise exception 'Napomena je preduga (najviše 1000 znakova).' using errcode = '22023';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' or coalesce(p ->> 'tip', '') not in ('ne', 'nedeljno') then
    raise exception 'Neispravno ponavljanje.' using errcode = '22023';
  end if;
  if p ->> 'tip' = 'nedeljno' then
    if coalesce(p ->> 'svakih', '') not in ('1', '2') then
      raise exception 'Neispravno ponavljanje.' using errcode = '22023';
    end if;
    if jsonb_typeof(p -> 'dani') is distinct from 'array' or jsonb_array_length(p -> 'dani') = 0 then
      raise exception 'Izaberi dane u nedelji.' using errcode = '22023';
    end if;
    if exists (select 1 from jsonb_array_elements_text(p -> 'dani') x where x !~ '^[0-6]$') then
      raise exception 'Neispravni dani u nedelji.' using errcode = '22023';
    end if;
    if p ->> 'do' is not null then
      if not public.ispravan_datum(p ->> 'do') then
        raise exception 'Neispravan kraj ponavljanja.' using errcode = '22023';
      end if;
      if (p ->> 'do') collate "C" < (d ->> 'datum') collate "C" then
        raise exception 'Ponavljanje mora da traje bar do prvog dana.' using errcode = '22023';
      end if;
    end if;
  end if;
end
$$;

-- An activity as it is stored in a request: only the known fields, trimmed.
-- Skipped days (izuzeti) are never part of a request.
create function public.cist_dogadjaj(d jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'naziv', btrim(d ->> 'naziv'),
    'vrsta', d ->> 'vrsta',
    'datum', d ->> 'datum',
    'ceoDan', coalesce((d ->> 'ceoDan')::boolean, false),
    'od', coalesce(d ->> 'od', ''),
    'do', coalesce(d ->> 'do', ''),
    'ponavljanje', case
      when d -> 'ponavljanje' ->> 'tip' = 'nedeljno' then jsonb_build_object(
        'tip', 'nedeljno',
        'svakih', (d -> 'ponavljanje' ->> 'svakih')::int,
        'dani', (select jsonb_agg(x order by x) from (select distinct x::int as x from jsonb_array_elements_text(d -> 'ponavljanje' -> 'dani') x) t),
        'do', d -> 'ponavljanje' ->> 'do')
      else '{"tip": "ne"}'::jsonb
    end,
    'vodi', d ->> 'vodi',
    'mesto', btrim(coalesce(d ->> 'mesto', '')),
    'napomena', btrim(coalesce(d ->> 'napomena', '')))
$$;

-- A stay as it is stored in a request: only the known fields.
create function public.cist_boravak(b jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'vrsta', b ->> 'vrsta', 'kod', b ->> 'kod', 'od', b ->> 'od', 'do', b ->> 'do',
    'napomena', btrim(coalesce(b ->> 'napomena', '')))
$$;

revoke execute on function public.cist_dogadjaj(jsonb) from public, anon, authenticated;
revoke execute on function public.cist_boravak(jsonb) from public, anon, authenticated;

-- Writing an activity from a request. A change keeps the series' skipped
-- days; a new activity starts with none.
create or replace function public.upisi_dogadjaj(p_porodica uuid, p_id uuid, d jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.dogadjaj as postojeci (id, porodica_id, naziv, vrsta, datum, ceo_dan, pocetak, kraj, ponavljanje, vodi, mesto, napomena, izuzeti)
  values (
    p_id, p_porodica, btrim(d ->> 'naziv'), d ->> 'vrsta', (d ->> 'datum')::date, coalesce((d ->> 'ceoDan')::boolean, false),
    coalesce(d ->> 'od', ''), coalesce(d ->> 'do', ''), d -> 'ponavljanje', d ->> 'vodi',
    btrim(coalesce(d ->> 'mesto', '')), btrim(coalesce(d ->> 'napomena', '')),
    '{}'
  )
  on conflict (id) do update set
    naziv = excluded.naziv, vrsta = excluded.vrsta, datum = excluded.datum, ceo_dan = excluded.ceo_dan,
    pocetak = excluded.pocetak, kraj = excluded.kraj, ponavljanje = excluded.ponavljanje, vodi = excluded.vodi,
    mesto = excluded.mesto, napomena = excluded.napomena, izuzeti = postojeci.izuzeti, kreirano = now()
$$;

create or replace function public.predlozi_kalendar(p_vrsta text, p_boravak_id uuid, p_boravci jsonb, p_poruka text)
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
  if length(coalesce(p_poruka, '')) > 1000 then
    raise exception 'Poruka je preduga (najviše 1000 znakova).' using errcode = '22023';
  end if;
  perform public.proveri_boravke(coalesce(p_boravci, '[]'::jsonb));
  sukob := public.preklapanje_boravaka(moja, coalesce(p_boravci, '[]'::jsonb), case when p_vrsta = 'izmeni' then p_boravak_id end);
  if sukob is not null then
    raise exception 'Preklapa se sa postojećim rasporedom: %.', sukob using errcode = '22023';
  end if;

  insert into public.zahtev_kalendara (porodica_id, predmet, vrsta, boravak_id, boravci, poruka, predlozio)
  values (
    moja, 'boravak', p_vrsta, case when p_vrsta = 'dodaj' then null else p_boravak_id end,
    (select coalesce(jsonb_agg(public.cist_boravak(b) order by i), '[]'::jsonb)
     from jsonb_array_elements(coalesce(p_boravci, '[]'::jsonb)) with ordinality x (b, i)),
    btrim(coalesce(p_poruka, '')), (select auth.uid())
  )
  returning id into novi;
  return novi;
end
$$;

create or replace function public.predlozi_dogadjaj(p_vrsta text, p_dogadjaj_id uuid, p_dogadjaj jsonb, p_poruka text, p_jednom date)
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
  if p_jednom is not null and p_dogadjaj -> 'ponavljanje' ->> 'tip' <> 'ne' then
    raise exception 'Pomereni termin se ne ponavlja.' using errcode = '22023';
  end if;
  if length(coalesce(p_poruka, '')) > 1000 then
    raise exception 'Poruka je preduga (najviše 1000 znakova).' using errcode = '22023';
  end if;

  insert into public.zahtev_kalendara (porodica_id, predmet, vrsta, dogadjaj_id, dogadjaj, jednom, poruka, predlozio)
  values (
    moja, 'dogadjaj', p_vrsta, case when p_vrsta = 'dodaj' then null else p_dogadjaj_id end,
    case when p_vrsta = 'obrisi' then null else public.cist_dogadjaj(p_dogadjaj) end,
    p_jednom, btrim(coalesce(p_poruka, '')), (select auth.uid())
  )
  returning id into novi;
  return novi;
end
$$;

-- The other parent accepts: the change is applied in one step. The family
-- row is locked first, so two acceptances at the same moment run one after
-- the other and the overlap check sees the first one's result.
create or replace function public.prihvati_zahtev(p_id uuid)
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
  perform 1 from public.porodica where id = z.porodica_id for update;
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

create or replace function public.odbij_zahtev(p_id uuid, p_razlog text)
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
  if length(t) > 1000 then
    raise exception 'Razlog je predug (najviše 1000 znakova).' using errcode = '22023';
  end if;
  update public.zahtev_kalendara set stanje = 'odbijen', razlog = t, reseno = now(), resio = (select auth.uid()) where id = z.id;
end
$$;

-- ===========================================================================
-- Karton: a field stays a field, a list entry stays a list entry
-- ===========================================================================

create or replace function public.sacuvaj_karton(p_id uuid, p_grupa text, p_naziv text, p_vrednost text, p_detalji jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  moja uuid := public.moj_prostor();
  v_grupa text := p_grupa;
  spisak boolean;
  v_naziv text := btrim(coalesce(p_naziv, ''));
  v_vrednost text;
  v_detalji jsonb;
  novi uuid;
begin
  -- A change keeps the stored group: the client does not decide whether an
  -- existing entry is a field or a list entry.
  if p_id is not null then
    select grupa into v_grupa from public.karton_unos where id = p_id and porodica_id = moja for update;
    if not found then
      raise exception 'To polje više ne postoji.' using errcode = 'P0002';
    end if;
  end if;
  if v_grupa is null or v_grupa not in ('osnovno', 'zdravlje', 'skola', 'nastavnici', 'aktivnosti', 'mere', 'kontakti', 'drugari') then
    raise exception 'Nepoznata grupa kartona.' using errcode = '22023';
  end if;
  spisak := v_grupa in ('nastavnici', 'aktivnosti', 'kontakti', 'drugari');
  v_vrednost := case when spisak then '' else btrim(coalesce(p_vrednost, '')) end;
  v_detalji := case when spisak then coalesce(p_detalji, '{}'::jsonb) end;

  if v_naziv = '' then
    raise exception '%', case when spisak then 'Upiši naziv.' else 'Upiši naziv polja.' end using errcode = '22023';
  end if;
  if not spisak and v_vrednost = '' then
    raise exception 'Upiši vrednost; prazno polje se briše.' using errcode = '22023';
  end if;
  if v_detalji is not null and (jsonb_typeof(v_detalji) <> 'object' or length(v_detalji::text) > 20000) then
    raise exception 'Detalji su neispravni ili predugi.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.karton_unos (porodica_id, grupa, naziv, vrednost, detalji, izmenio)
    values (moja, v_grupa, v_naziv, v_vrednost, v_detalji, (select auth.uid()))
    returning id into novi;
    return novi;
  end if;

  update public.karton_unos
  set naziv = v_naziv, vrednost = v_vrednost, detalji = v_detalji, izmenio = (select auth.uid()), izmenjeno = now()
  where id = p_id and porodica_id = moja
    and (karton_unos.naziv, karton_unos.vrednost, karton_unos.detalji) is distinct from (v_naziv, v_vrednost, v_detalji);
  return p_id;
end
$$;

-- ===========================================================================
-- Size limits (the functions above give friendly messages; these are the
-- backstop for every writer)
-- ===========================================================================

alter table public.zahtev_kalendara
  add constraint zahtev_razlog_duzina check (length(razlog) <= 1000),
  add constraint zahtev_velicina check (length(boravci::text) <= 400000 and length(coalesce(dogadjaj::text, '')) <= 10000);
alter table public.karton_unos
  add constraint karton_detalji_velicina check (detalji is null or length(detalji::text) <= 20000);
alter table public.raspored_casova
  add constraint raspored_velicina check (length(casovi::text) <= 200000 and length(tabela::text) <= 200000);
alter table public.pozivnica
  add constraint pozivnica_email_ispravan check (email is null or (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'));

-- ===========================================================================
-- Documents
-- ===========================================================================

-- Uploads only as <family>/<uuid>.<ext>: nothing else can become a document,
-- and nothing else could ever be deleted, so nothing else may be stored.
drop policy "dokumenti: roditelji otpremaju" on storage.objects;
create policy "dokumenti: roditelji otpremaju" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dokumenti'
    and name ~ ('^' || (select public.moja_porodica())::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$')
    and (select public.mfa_ispunjen())
  );

-- After the file is uploaded: describe it. Only the parent who uploaded the
-- file registers it; size comes from the stored file, and its type must match
-- the extension in its name.
create or replace function public.dodaj_dokument(
  p_id uuid,
  p_putanja text,
  p_naziv text,
  p_kategorija text,
  p_datum date,
  p_napomena text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  moja uuid := public.moja_porodica();
  fajl record;
  ocekivan text;
begin
  if moja is null then
    raise exception 'Nisi u porodičnom prostoru.' using errcode = '42501';
  end if;
  perform public.proveri_dokument(p_naziv, p_kategorija, p_napomena);
  if p_id is null or p_putanja is null or p_putanja !~ ('^' || moja::text || '/' || p_id::text || '\.(jpg|png|webp|pdf)$') then
    raise exception 'Fajl nije u prostoru tvoje porodice.' using errcode = '42501';
  end if;

  select o.name, o.metadata into fajl
  from storage.objects o
  where o.bucket_id = 'dokumenti' and o.name = p_putanja and o.owner_id = ja::text;
  if not found then
    raise exception 'Fajl nije otpremljen.' using errcode = 'P0002';
  end if;
  ocekivan := case substring(p_putanja from '\.([a-z]+)$')
    when 'jpg' then 'image/jpeg' when 'png' then 'image/png' when 'webp' then 'image/webp' when 'pdf' then 'application/pdf'
  end;
  if fajl.metadata ->> 'mimetype' is distinct from ocekivan then
    raise exception 'Vrsta fajla se ne slaže sa njegovim nazivom.' using errcode = '22023';
  end if;

  insert into public.dokument (id, porodica_id, putanja, naziv, kategorija, datum, napomena, tip, velicina, otpremio)
  values (
    p_id,
    moja,
    p_putanja,
    btrim(p_naziv),
    p_kategorija,
    p_datum,
    btrim(coalesce(p_napomena, '')),
    fajl.metadata ->> 'mimetype',
    (fajl.metadata ->> 'size')::bigint,
    ja
  );
  insert into public.dokument_trag (dokument_id, porodica_id, vrsta, ko) values (p_id, moja, 'otpremljen', ja);
  return p_id;
end
$$;

-- ===========================================================================
-- Invitations
-- ===========================================================================

-- The family row is locked, so two calls at the same moment cannot leave two
-- working links behind.
create or replace function public.napravi_pozivnicu(p_email text default null)
returns table (token text, istice timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  moja uuid;
  moja_uloga text;
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  do_kada timestamptz := now() + interval '7 days';
begin
  select porodica_id, uloga into moja, moja_uloga from public.roditelj where korisnik = ja;
  if moja is null then
    raise exception 'Prvo napravi porodični prostor.' using errcode = '42501';
  end if;
  perform 1 from public.porodica where id = moja for update;
  if (select count(*) from public.roditelj where porodica_id = moja) >= 2 then
    raise exception 'Oba roditelja su već povezana.' using errcode = '23505';
  end if;
  if v_email is not null and (length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    raise exception 'Mejl nije ispravan.' using errcode = '22023';
  end if;

  delete from public.pozivnica p where p.porodica_id = moja and p.iskoriscena is null;
  insert into public.pozivnica (porodica_id, token_hash, uloga, email, pozvao, istice)
  values (moja, public.hes(t), case moja_uloga when 'tata' then 'mama' else 'tata' end, v_email, ja, do_kada);
  return query select t, do_kada;
end
$$;

-- What a link holder may see before accepting: child's first name, who
-- invites, which role they would take, and whether the link still works.
-- A used or expired link says only that.
create or replace function public.pogledaj_pozivnicu(p_token text)
returns table (dete text, pozvao text, uloga text, vazi boolean, razlog text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.pozivnica;
begin
  select * into p from public.pozivnica where token_hash = public.hes(coalesce(p_token, ''));
  if p.id is null then
    return query select null::text, null::text, null::text, false, 'Link ne postoji ili je zamenjen novim.';
    return;
  end if;
  if p.iskoriscena is not null or p.istice <= now() then
    return query select null::text, null::text, null::text, false,
      case when p.iskoriscena is not null then 'Link je već iskorišćen.' else 'Link je istekao. Zatraži novi.' end;
    return;
  end if;
  return query
    select
      (select d.ime from public.dete d where d.porodica_id = p.porodica_id order by d.kreirano limit 1),
      (select r.oznaka from public.roditelj r where r.korisnik = p.pozvao),
      p.uloga,
      true,
      null::text;
end
$$;
