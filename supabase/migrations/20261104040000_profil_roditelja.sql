-- Parent profile: name, phone, address, contact e-mail and a note. Both
-- parents see both profiles; each one edits only their own, through
-- sacuvaj_profil (the table still has no write policies).

alter table public.roditelj
  add column ime text not null default '' check (length(ime) <= 80),
  add column telefon text not null default '' check (length(telefon) <= 40 and telefon ~ '^[0-9 +()/-]*$'),
  add column adresa text not null default '' check (length(adresa) <= 200),
  add column kontakt_email text not null default '' check (length(kontakt_email) <= 120 and (kontakt_email = '' or kontakt_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  add column napomena text not null default '' check (length(napomena) <= 300),
  add column profil_izmenjen timestamptz;

create function public.sacuvaj_profil(p_ime text, p_telefon text, p_adresa text, p_kontakt_email text, p_napomena text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  v_ime text := btrim(coalesce(p_ime, ''));
  v_telefon text := btrim(coalesce(p_telefon, ''));
  v_adresa text := btrim(coalesce(p_adresa, ''));
  v_email text := lower(btrim(coalesce(p_kontakt_email, '')));
  v_napomena text := btrim(coalesce(p_napomena, ''));
begin
  if length(v_ime) > 80 then
    raise exception 'Ime je predugo (najviše 80 znakova).' using errcode = '22023';
  end if;
  if length(v_telefon) > 40 or v_telefon !~ '^[0-9 +()/-]*$' then
    raise exception 'Telefon sme da ima samo cifre, razmake i znakove + - / ( ).' using errcode = '22023';
  end if;
  if length(v_adresa) > 200 then
    raise exception 'Adresa je preduga (najviše 200 znakova).' using errcode = '22023';
  end if;
  if length(v_email) > 120 or (v_email <> '' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then
    raise exception 'Mejl nije ispravan.' using errcode = '22023';
  end if;
  if length(v_napomena) > 300 then
    raise exception 'Napomena je preduga (najviše 300 znakova).' using errcode = '22023';
  end if;

  update public.roditelj
  set ime = v_ime, telefon = v_telefon, adresa = v_adresa, kontakt_email = v_email, napomena = v_napomena, profil_izmenjen = now()
  where korisnik = ja;
  if not found then
    raise exception 'Nisi u porodičnom prostoru.' using errcode = '42501';
  end if;
end
$$;

revoke execute on function public.sacuvaj_profil(text, text, text, text, text) from public, anon;
grant execute on function public.sacuvaj_profil(text, text, text, text, text) to authenticated;
