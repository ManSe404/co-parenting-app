-- E-mail notifications (F2): the rules live here, the sending does not.
--
-- Every action one parent takes that the other should know about puts one
-- row into the queue `obavestenje`, addressed to the OTHER parent. Triggers
-- fill it; nobody writes it directly. A sender outside the database (the Edge
-- Function supabase/functions/obavestenja) reads what is due with
-- obavestenja_za_slanje(), sends it, and marks it with oznaci_poslato().
--
-- Each parent chooses on `roditelj.obavestenja`:
--   'odmah'   every notification as soon as it happens;
--   'dnevno'  (default) one digest a day, but anything urgent at once;
--   'nikad'   nothing is even queued.
-- "Urgent" (hitno) is an item carrying the Hitno flag, or a calendar proposal
-- that starts within 48 hours.
--
-- The e-mail text never carries karton values (they may be health data): it
-- names the field that changed, not what it says.

-- ---------------------------------------------------------------------------
-- Preference
-- ---------------------------------------------------------------------------

alter table public.roditelj
  add column obavestenja text not null default 'dnevno' check (obavestenja in ('odmah', 'dnevno', 'nikad'));

-- ---------------------------------------------------------------------------
-- Queue
-- ---------------------------------------------------------------------------

create table public.obavestenje (
  id uuid primary key default gen_random_uuid(),
  porodica_id uuid not null references public.porodica (id) on delete cascade,
  -- The auth user who gets the e-mail.
  za_roditelja uuid not null references auth.users (id) on delete cascade,
  vrsta text not null check (vrsta in (
    'nova_stavka', 'odgovor', 'predlog_zatvaranja', 'zatvoreno', 'odbijeno_zatvaranje', 'povucen_predlog',
    'aktivirano', 'ponovo_otvoreno', 'izmenjeno',
    'predlog_kalendara', 'prihvacen_zahtev', 'odbijen_zahtev',
    'dokument', 'karton'
  )),
  hitno boolean not null default false,
  -- Limits leave room for the "…" that skrati() adds.
  naslov text not null check (length(naslov) <= 400),
  tekst text not null default '' check (length(tekst) <= 2500),
  -- Where the e-mail link points, inside the app (e.g. /stavka/?id=…).
  putanja text not null default '/' check (putanja like '/%' and length(putanja) <= 200),
  kreirano timestamptz not null default now(),
  poslato timestamptz,
  greska text check (length(greska) <= 1200)
);

create index obavestenje_neposlato on public.obavestenje (za_roditelja, kreirano) where poslato is null;
create index obavestenje_porodica on public.obavestenje (porodica_id);

alter table public.obavestenje enable row level security;
revoke insert, update, delete, truncate on public.obavestenje from anon, authenticated;

-- A parent reads only the rows addressed to them.
create policy "roditelj cita svoja obavestenja" on public.obavestenje
  for select to authenticated using (za_roditelja = (select auth.uid()));
create policy "mfa obavestenje" on public.obavestenje
  as restrictive for all to authenticated using ((select public.mfa_ispunjen()));

-- ---------------------------------------------------------------------------
-- Helpers for the triggers
-- ---------------------------------------------------------------------------

-- The other parent of a family (null before the second one joins).
create function public.drugi_roditelj(p_porodica uuid, p_od uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select korisnik from public.roditelj where porodica_id = p_porodica and korisnik is distinct from p_od limit 1
$$;

-- "Tata" / "Mama" (or the role as a fallback) for the e-mail text.
create function public.oznaka_roditelja(p_korisnik uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select oznaka from public.roditelj where korisnik = p_korisnik), 'Drugi roditelj')
$$;

-- A past-tense verb in the right gender: glagol(uuid, 'otvorio', 'otvorila').
create function public.glagol(p_korisnik uuid, p_on text, p_ona text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case (select uloga from public.roditelj where korisnik = p_korisnik) when 'mama' then p_ona else p_on end
$$;

create function public.skrati(p_tekst text, p_duzina int default 300)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_tekst is null then ''
    when length(p_tekst) > p_duzina then left(p_tekst, p_duzina) || '…'
    else p_tekst
  end
$$;

-- Puts one row into the queue, unless the recipient does not want any.
create function public.zakazi_obavestenje(
  p_porodica uuid, p_za uuid, p_vrsta text, p_hitno boolean, p_naslov text, p_tekst text, p_putanja text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_za is null then
    return;
  end if;
  if (select obavestenja from public.roditelj where korisnik = p_za) is distinct from 'nikad' then
    insert into public.obavestenje (porodica_id, za_roditelja, vrsta, hitno, naslov, tekst, putanja)
    values (p_porodica, p_za, p_vrsta, coalesce(p_hitno, false), public.skrati(p_naslov, 300), public.skrati(p_tekst, 2000), coalesce(p_putanja, '/'));
  end if;
end
$$;

revoke execute on function public.drugi_roditelj(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.oznaka_roditelja(uuid) from public, anon, authenticated;
revoke execute on function public.glagol(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.skrati(text, int) from public, anon, authenticated;
revoke execute on function public.zakazi_obavestenje(uuid, uuid, text, boolean, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Items: a new item, and every entry in its thread
-- ---------------------------------------------------------------------------

create function public.obavesti_o_stavci()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ko text := public.oznaka_roditelja(new.otvorio);
begin
  perform public.zakazi_obavestenje(
    new.porodica_id, public.drugi_roditelj(new.porodica_id, new.otvorio), 'nova_stavka', new.hitno,
    format('Nova stavka: „%s“', new.naslov),
    format('%s je %s stavku (%s, rok: %s).%s', ko, public.glagol(new.otvorio, 'otvorio', 'otvorila'),
           public.naziv_oblasti(new.oblast), public.rok_tekst(new.datum),
           case when new.opis = '' then '' else E'\n' || public.skrati(new.opis) end),
    '/stavka/?id=' || new.id::text
  );
  return new;
end
$$;

create trigger stavka_obavestenje
after insert on public.stavka
for each row execute function public.obavesti_o_stavci();

create function public.obavesti_o_unosu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.stavka;
  ko text := public.oznaka_roditelja(new.autor);
  naslov text;
  tekst text;
begin
  select * into s from public.stavka where id = new.stavka_id;
  if not found then
    return new;
  end if;
  case new.vrsta
    when 'odgovor' then
      naslov := format('Odgovor: „%s“', s.naslov);
      tekst := format('%s je %s: %s', ko, public.glagol(new.autor, 'odgovorio', 'odgovorila'), public.skrati(new.tekst));
    when 'predlog_zatvaranja' then
      naslov := format('Predlog zatvaranja: „%s“', s.naslov);
      tekst := format('%s predlaže da se stavka zatvori. Odluka: %s', ko, public.skrati(new.tekst));
    when 'zatvoreno' then
      naslov := format('Zatvoreno: „%s“', s.naslov);
      tekst := format('%s je %s zatvaranje. Odluka: %s', ko, public.glagol(new.autor, 'potvrdio', 'potvrdila'), public.skrati(new.tekst));
    when 'odbijeno_zatvaranje' then
      naslov := format('Zatvaranje odbijeno: „%s“', s.naslov);
      tekst := format('%s se ne slaže sa zatvaranjem: %s', ko, public.skrati(new.tekst));
    when 'povucen_predlog' then
      naslov := format('Predlog povučen: „%s“', s.naslov);
      tekst := format('%s je %s predlog zatvaranja.', ko, public.glagol(new.autor, 'povukao', 'povukla'));
    when 'aktivirano' then
      naslov := format('Aktivirano: „%s“', s.naslov);
      tekst := format('%s je %s stavku u Aktivno.%s', ko, public.glagol(new.autor, 'prebacio', 'prebacila'),
                      case when new.tekst = '' then '' else ' ' || public.skrati(new.tekst) end);
    when 'ponovo_otvoreno' then
      naslov := format('Ponovo otvoreno: „%s“', s.naslov);
      tekst := format('%s je ponovo %s stavku: %s', ko, public.glagol(new.autor, 'otvorio', 'otvorila'), public.skrati(new.tekst));
    when 'izmenjeno' then
      naslov := format('Izmena: „%s“', s.naslov);
      tekst := format('%s je %s stavku:%s%s', ko, public.glagol(new.autor, 'izmenio', 'izmenila'), E'\n', public.skrati(new.tekst, 600));
    else
      return new;
  end case;
  perform public.zakazi_obavestenje(
    new.porodica_id, public.drugi_roditelj(new.porodica_id, new.autor), new.vrsta, s.hitno, naslov, tekst, '/stavka/?id=' || s.id::text
  );
  return new;
end
$$;

create trigger unos_obavestenje
after insert on public.unos
for each row execute function public.obavesti_o_unosu();

-- ---------------------------------------------------------------------------
-- Calendar: a proposal, and its answer
-- ---------------------------------------------------------------------------

-- Wall-clock times in the calendar are Serbian local time (no zone stored);
-- "within 48 hours" is measured on the same clock.
create function public.sada_lokalno()
returns timestamp
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Europe/Belgrade')::timestamp
$$;

-- One line that says what a calendar request is about.
create function public.opis_zahteva(z public.zahtev_kalendara)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  b jsonb;
  d jsonb := z.dogadjaj;
  n int;
  sta text;
begin
  if z.predmet = 'dogadjaj' then
    if z.vrsta = 'obrisi' then
      select format('brisanje aktivnosti „%s“', naziv) into sta from public.dogadjaj where id = z.dogadjaj_id;
      return coalesce(sta, 'brisanje aktivnosti');
    end if;
    sta := format('%s aktivnost „%s“, %s%s',
      case when z.vrsta = 'dodaj' then 'nova' when z.jednom is not null then 'pomerena (samo jednom)' else 'izmenjena' end,
      d ->> 'naziv', public.rok_tekst((d ->> 'datum')::date),
      case when coalesce((d ->> 'ceoDan')::boolean, false) then '' else format(' %s–%s', d ->> 'od', d ->> 'do') end);
    return sta;
  end if;
  if z.vrsta = 'obrisi' then
    select format('brisanje boravka kod %s od %s do %s',
                  coalesce((select r.oznaka_genitiv from public.roditelj r where r.porodica_id = z.porodica_id and r.uloga = b2.kod), b2.kod),
                  replace(b2.pocetak, 'T', ' '), replace(b2.kraj, 'T', ' '))
    into sta from public.boravak b2 where b2.id = z.boravak_id;
    return coalesce(sta, 'brisanje boravka');
  end if;
  n := jsonb_array_length(z.boravci);
  b := z.boravci -> 0;
  sta := format('%s: dete kod %s od %s do %s',
    case when z.vrsta = 'izmeni' then 'izmena boravka' when b ->> 'vrsta' = 'izuzetak' then 'jednokratna promena' else 'redovan raspored' end,
    coalesce((select oznaka_genitiv from public.roditelj r where r.porodica_id = z.porodica_id and r.uloga = b ->> 'kod'), b ->> 'kod'),
    replace(b ->> 'od', 'T', ' '), replace(b ->> 'do', 'T', ' '));
  if n > 1 then
    sta := sta || format(' (i još %s)', n - 1);
  end if;
  return sta;
end
$$;

-- True when the proposal touches the next 48 hours.
create function public.zahtev_je_hitan(z public.zahtev_kalendara)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  granica timestamp := public.sada_lokalno() + interval '48 hours';
  prvi timestamp;
begin
  if z.predmet = 'dogadjaj' then
    if z.vrsta = 'obrisi' then
      select (datum::text || ' ' || coalesce(nullif(pocetak, ''), '00:00'))::timestamp into prvi from public.dogadjaj where id = z.dogadjaj_id;
    else
      prvi := ((z.dogadjaj ->> 'datum') || ' ' || coalesce(nullif(z.dogadjaj ->> 'od', ''), '00:00'))::timestamp;
    end if;
  elsif z.vrsta = 'obrisi' then
    select replace(pocetak, 'T', ' ')::timestamp into prvi from public.boravak where id = z.boravak_id;
  else
    select min(replace(b ->> 'od', 'T', ' ')::timestamp) into prvi from jsonb_array_elements(z.boravci) b;
  end if;
  return prvi is not null and prvi <= granica;
exception when others then
  return false;
end
$$;

create function public.obavesti_o_zahtevu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ko text;
  opis text := public.opis_zahteva(new);
begin
  if tg_op = 'INSERT' then
    ko := public.oznaka_roditelja(new.predlozio);
    perform public.zakazi_obavestenje(
      new.porodica_id, public.drugi_roditelj(new.porodica_id, new.predlozio), 'predlog_kalendara', public.zahtev_je_hitan(new),
      'Predlog za kalendar: ' || opis,
      format('%s predlaže: %s.%s', ko, opis, case when new.poruka = '' then '' else E'\n' || public.skrati(new.poruka) end),
      '/kalendar/'
    );
  elsif old.stanje = 'ceka' and new.stanje = 'prihvacen' then
    ko := public.oznaka_roditelja(new.resio);
    perform public.zakazi_obavestenje(
      new.porodica_id, new.predlozio, 'prihvacen_zahtev', public.zahtev_je_hitan(new),
      'Predlog prihvaćen: ' || opis,
      format('%s je %s tvoj predlog za kalendar (%s).', ko, public.glagol(new.resio, 'prihvatio', 'prihvatila'), opis),
      '/kalendar/'
    );
  elsif old.stanje = 'ceka' and new.stanje = 'odbijen' then
    ko := public.oznaka_roditelja(new.resio);
    perform public.zakazi_obavestenje(
      new.porodica_id, new.predlozio, 'odbijen_zahtev', public.zahtev_je_hitan(new),
      'Predlog odbijen: ' || opis,
      format('%s nije %s tvoj predlog za kalendar (%s): %s', ko, public.glagol(new.resio, 'prihvatio', 'prihvatila'), opis, public.skrati(new.razlog)),
      '/kalendar/'
    );
  end if;
  return new;
end
$$;

create trigger zahtev_kalendara_obavestenje
after insert or update of stanje on public.zahtev_kalendara
for each row execute function public.obavesti_o_zahtevu();

-- ---------------------------------------------------------------------------
-- Documents and karton
-- ---------------------------------------------------------------------------

create function public.obavesti_o_dokumentu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.zakazi_obavestenje(
    new.porodica_id, public.drugi_roditelj(new.porodica_id, new.otpremio), 'dokument', false,
    format('Nov dokument: „%s“', new.naziv),
    format('%s je %s dokument „%s“ (%s%s).', public.oznaka_roditelja(new.otpremio), public.glagol(new.otpremio, 'dodao', 'dodala'),
           new.naziv,
           case new.kategorija when 'skola' then 'škola' when 'zdravlje' then 'zdravlje' when 'vanskolske' then 'vanškolske aktivnosti'
                               when 'licna' then 'lična dokumenta' when 'pravno' then 'pravno' when 'troskovi' then 'troškovi' else 'ostalo' end,
           case when new.datum is null then '' else ', ' || public.rok_tekst(new.datum) end),
    '/dokumenti/?d=' || new.id::text
  );
  return new;
end
$$;

create trigger dokument_obavestenje
after insert on public.dokument
for each row execute function public.obavesti_o_dokumentu();

-- Karton: the field is named, its value is not (it may be health data).
create function public.obavesti_o_kartonu()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  autor uuid := coalesce(new.autor, (select auth.uid()));
  sta text := case
    when new.staro is null then public.glagol(autor, 'dodao', 'dodala')
    when new.novo is null then public.glagol(autor, 'obrisao', 'obrisala')
    else public.glagol(autor, 'izmenio', 'izmenila')
  end;
begin
  perform public.zakazi_obavestenje(
    new.porodica_id, public.drugi_roditelj(new.porodica_id, autor), 'karton', false,
    format('Karton: %s', new.naziv),
    format('%s je %s „%s“ u kartonu (%s).', public.oznaka_roditelja(autor), sta, new.naziv,
           case new.grupa when 'osnovno' then 'osnovno' when 'zdravlje' then 'zdravlje' when 'skola' then 'škola' when 'nastavnici' then 'nastavnici'
                          when 'aktivnosti' then 'aktivnosti' when 'mere' then 'mere i veličine' when 'kontakti' then 'kontakti' when 'drugari' then 'drugari' else new.grupa end),
    '/karton/'
  );
  return new;
end
$$;

create trigger karton_izmena_obavestenje
after insert on public.karton_izmena
for each row execute function public.obavesti_o_kartonu();

revoke execute on function public.obavesti_o_stavci() from public, anon, authenticated;
revoke execute on function public.obavesti_o_unosu() from public, anon, authenticated;
revoke execute on function public.obavesti_o_zahtevu() from public, anon, authenticated;
revoke execute on function public.obavesti_o_dokumentu() from public, anon, authenticated;
revoke execute on function public.obavesti_o_kartonu() from public, anon, authenticated;
revoke execute on function public.opis_zahteva(public.zahtev_kalendara) from public, anon, authenticated;
revoke execute on function public.zahtev_je_hitan(public.zahtev_kalendara) from public, anon, authenticated;
revoke execute on function public.sada_lokalno() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The parent's choice
-- ---------------------------------------------------------------------------

create function public.postavi_obavestenja(p_rezim text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
begin
  if p_rezim is null or p_rezim not in ('odmah', 'dnevno', 'nikad') then
    raise exception 'Izaberi: odmah, dnevno ili nikad.' using errcode = '22023';
  end if;
  update public.roditelj set obavestenja = p_rezim where korisnik = ja;
  if not found then
    raise exception 'Nisi u porodičnom prostoru.' using errcode = '42501';
  end if;
  -- "Never" also drops what was queued and not yet sent.
  if p_rezim = 'nikad' then
    delete from public.obavestenje where za_roditelja = ja and poslato is null;
  end if;
end
$$;

revoke execute on function public.postavi_obavestenja(text) from public, anon;
grant execute on function public.postavi_obavestenja(text) to authenticated;

-- ---------------------------------------------------------------------------
-- For the sender only (service role): what is due, and marking it
-- ---------------------------------------------------------------------------

-- 'odmah': every unsent urgent row, plus every unsent row of a parent who
-- wants everything at once. 'dnevno': every unsent row of a parent who wants
-- the daily digest (urgent ones were sent earlier by 'odmah', so they are no
-- longer here). Ordered by recipient, so the sender groups them into one
-- e-mail each. Rows older than 7 days are left alone: a digest of stale news
-- after a long outage would not help anyone.
create function public.obavestenja_za_slanje(p_rezim text)
returns table (
  id uuid, za_roditelja uuid, email text, oznaka text, vrsta text, hitno boolean,
  naslov text, tekst text, putanja text, kreirano timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.za_roditelja, u.email::text, r.oznaka, o.vrsta, o.hitno, o.naslov, o.tekst, o.putanja, o.kreirano
  from public.obavestenje o
  join public.roditelj r on r.korisnik = o.za_roditelja
  join auth.users u on u.id = o.za_roditelja
  where o.poslato is null
    and o.kreirano > now() - interval '7 days'
    and u.email is not null
    and r.obavestenja <> 'nikad'
    and case p_rezim
      when 'odmah' then (o.hitno or r.obavestenja = 'odmah')
      when 'dnevno' then r.obavestenja = 'dnevno'
      else false
    end
  order by o.za_roditelja, o.kreirano
$$;

-- p_greska null: sent now. Otherwise the error is kept and the row stays due,
-- so the next run tries again (for up to 7 days, see above).
create function public.oznaci_poslato(p_ids uuid[], p_greska text default null)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  update public.obavestenje
  set poslato = case when p_greska is null then now() else poslato end,
      greska = case when p_greska is null then null else public.skrati(p_greska, 1000) end
  where id = any (coalesce(p_ids, '{}'));
  get diagnostics n = row_count;
  return n;
end
$$;

-- Only the service role (the Edge Function) may call these two; a signed-in
-- parent gets "permission denied".
revoke execute on function public.obavestenja_za_slanje(text) from public, anon, authenticated;
revoke execute on function public.oznaci_poslato(uuid[], text) from public, anon, authenticated;
grant execute on function public.obavestenja_za_slanje(text) to service_role;
grant execute on function public.oznaci_poslato(uuid[], text) to service_role;
