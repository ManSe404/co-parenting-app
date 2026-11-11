-- Deleting a family space, and then one's own account.
--
-- Everything in the space belongs to both parents, so it goes only when both
-- ask. Each parent calls obrisi_porodicu(); the first call is recorded, the
-- second one completes it. A parent who asked can change their mind until
-- the other one asks too (odustani_od_brisanja).
--
-- Files in the bucket are removed through the Storage API (a SQL delete
-- would leave the objects behind), so the second call first returns the
-- paths that still exist; the bucket lets a parent delete them once the
-- family is approved for deletion; the next call then removes every row.
-- A family with one parent is deleted by that parent alone.
--
-- obrisi_nalog() removes the caller's own auth account, only after they have
-- left the family space this way.

alter table public.roditelj add column brisanje_zatrazeno timestamptz;
alter table public.porodica add column brisanje_odobreno timestamptz;

create function public.brisanje_porodice_odobreno()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.porodica where id = public.moja_porodica() and brisanje_odobreno is not null)
$$;

revoke execute on function public.brisanje_porodice_odobreno() from public, anon;
grant execute on function public.brisanje_porodice_odobreno() to authenticated;

create policy "dokumenti: brisanje kad se porodica brise" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'dokumenti'
    and (storage.foldername(name))[1] = (select public.moja_porodica())::text
    and (select public.mfa_ispunjen())
    and (select public.brisanje_porodice_odobreno())
  );

-- Returns {"stanje": "ceka"} (waiting for the other parent), {"stanje":
-- "fajlovi", "putanje": [...]} (remove these through the Storage API and call
-- again) or {"stanje": "obrisano"}.
create function public.obrisi_porodicu()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  moja uuid;
  fajlovi text[];
begin
  select porodica_id into moja from public.roditelj where korisnik = ja;
  if moja is null then
    raise exception 'Nisi u porodičnom prostoru.' using errcode = '42501';
  end if;
  perform 1 from public.porodica where id = moja for update;

  update public.roditelj set brisanje_zatrazeno = coalesce(brisanje_zatrazeno, now()) where korisnik = ja;
  if exists (select 1 from public.roditelj where porodica_id = moja and brisanje_zatrazeno is null) then
    return jsonb_build_object('stanje', 'ceka');
  end if;

  update public.porodica set brisanje_odobreno = coalesce(brisanje_odobreno, now()) where id = moja;
  select array_agg(name order by name) into fajlovi
  from storage.objects where bucket_id = 'dokumenti' and name like moja::text || '/%';
  if fajlovi is not null then
    return jsonb_build_object('stanje', 'fajlovi', 'putanje', to_jsonb(fajlovi));
  end if;

  -- Order matters: a karton row that goes is logged by its trigger into
  -- karton_izmena, and that would notify the other parent. The queue and the
  -- parents go first, so nothing new is written while the rest is removed;
  -- deleting the family then cascades to everything else.
  delete from public.obavestenje where porodica_id = moja;
  delete from public.roditelj where porodica_id = moja;
  delete from public.karton_unos where porodica_id = moja;
  delete from public.raspored_casova where porodica_id = moja;
  delete from public.porodica where id = moja;
  return jsonb_build_object('stanje', 'obrisano');
end
$$;

create function public.odustani_od_brisanja()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
  moja uuid;
begin
  select porodica_id into moja from public.roditelj where korisnik = ja;
  if moja is null then
    raise exception 'Nisi u porodičnom prostoru.' using errcode = '42501';
  end if;
  perform 1 from public.porodica where id = moja for update;
  if (select brisanje_odobreno from public.porodica where id = moja) is not null then
    raise exception 'Oba roditelja su potvrdila brisanje; više ne može da se odustane.' using errcode = '22023';
  end if;
  update public.roditelj set brisanje_zatrazeno = null where korisnik = ja;
end
$$;

-- The caller's own account: e-mail, password, MFA factors, sessions. Only
-- once they are out of a family space, so no shared data is left orphaned.
create function public.obrisi_nalog()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ja uuid := public.prijavljen_sa_mfa();
begin
  if exists (select 1 from public.roditelj where korisnik = ja) then
    raise exception 'Prvo obriši porodični prostor (Podešavanja → Brisanje).' using errcode = '42501';
  end if;
  delete from auth.users where id = ja;
end
$$;

revoke execute on function public.obrisi_porodicu() from public, anon;
revoke execute on function public.odustani_od_brisanja() from public, anon;
revoke execute on function public.obrisi_nalog() from public, anon;
grant execute on function public.obrisi_porodicu() to authenticated;
grant execute on function public.odustani_od_brisanja() to authenticated;
grant execute on function public.obrisi_nalog() to authenticated;
