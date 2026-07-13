create table if not exists public.match3_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.match3_user_characters (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null check (character_id ~ '^[a-z0-9_]{3,64}$'),
  acquired_at timestamptz not null default now(),
  acquisition_source text not null default 'starter' check (char_length(btrim(acquisition_source)) > 0),
  primary key (user_id, character_id)
);

create table if not exists public.match3_user_loadouts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  combatant_character_id text not null check (combatant_character_id ~ '^[a-z0-9_]{3,64}$'),
  support_character_id_1 text not null check (support_character_id_1 ~ '^[a-z0-9_]{3,64}$'),
  support_character_id_2 text not null check (support_character_id_2 ~ '^[a-z0-9_]{3,64}$'),
  loadout_version integer not null default 1 check (loadout_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (combatant_character_id <> support_character_id_1 and combatant_character_id <> support_character_id_2 and support_character_id_1 <> support_character_id_2)
);

alter table public.match3_profiles enable row level security;
alter table public.match3_user_characters enable row level security;
alter table public.match3_user_loadouts enable row level security;

revoke all on public.match3_profiles, public.match3_user_characters, public.match3_user_loadouts from public, anon, authenticated;

create or replace function public.match3_set_updated_at()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.match3_set_updated_at() from public, anon, authenticated;

drop trigger if exists match3_profiles_updated_at on public.match3_profiles;
create trigger match3_profiles_updated_at before update on public.match3_profiles for each row execute function public.match3_set_updated_at();
drop trigger if exists match3_user_loadouts_updated_at on public.match3_user_loadouts;
create trigger match3_user_loadouts_updated_at before update on public.match3_user_loadouts for each row execute function public.match3_set_updated_at();

create or replace function public.match3_bootstrap_user(
  p_user_id uuid,
  p_display_name text,
  p_character_ids text[],
  p_combatant_character_id text,
  p_support_character_id_1 text,
  p_support_character_id_2 text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare result jsonb;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Unknown auth user'; end if;
  if coalesce(array_length(p_character_ids, 1), 0) = 0 or exists (select 1 from unnest(p_character_ids) value where btrim(value) = '') then raise exception 'Invalid character list'; end if;
  if p_combatant_character_id = p_support_character_id_1 or p_combatant_character_id = p_support_character_id_2 or p_support_character_id_1 = p_support_character_id_2 then raise exception 'Loadout characters must be distinct'; end if;
  if not (p_combatant_character_id = any(p_character_ids) and p_support_character_id_1 = any(p_character_ids) and p_support_character_id_2 = any(p_character_ids)) then raise exception 'Default loadout must use starter characters'; end if;
  insert into public.match3_profiles(user_id, display_name) values (p_user_id, p_display_name) on conflict (user_id) do update set last_seen_at = now();
  insert into public.match3_user_characters(user_id, character_id) select p_user_id, value from unnest(p_character_ids) value on conflict do nothing;
  insert into public.match3_user_loadouts(user_id, combatant_character_id, support_character_id_1, support_character_id_2) values (p_user_id, p_combatant_character_id, p_support_character_id_1, p_support_character_id_2) on conflict (user_id) do nothing;
  select jsonb_build_object(
    'profile', jsonb_build_object('display_name', p.display_name, 'created_at', p.created_at, 'updated_at', p.updated_at, 'last_seen_at', p.last_seen_at),
    'owned_character_ids', (select jsonb_agg(c.character_id order by c.character_id) from public.match3_user_characters c where c.user_id = p_user_id),
    'loadout', jsonb_build_object('combatant_character_id', l.combatant_character_id, 'support_character_id_1', l.support_character_id_1, 'support_character_id_2', l.support_character_id_2, 'loadout_version', l.loadout_version)
  ) into result from public.match3_profiles p join public.match3_user_loadouts l on l.user_id = p.user_id where p.user_id = p_user_id;
  return result;
end;
$$;

revoke all on function public.match3_bootstrap_user(uuid, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.match3_bootstrap_user(uuid, text, text[], text, text, text) to service_role;
