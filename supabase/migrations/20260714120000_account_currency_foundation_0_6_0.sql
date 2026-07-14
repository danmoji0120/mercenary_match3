create table if not exists public.match3_user_currencies (
  user_id uuid not null references auth.users(id) on delete cascade,
  currency_id text not null check (currency_id in ('gold','recruit_token','rarity_shard_r','rarity_shard_sr','rarity_shard_ssr','rarity_shard_ex')),
  balance bigint not null default 0 check (balance between 0 and 9007199254740991),
  updated_at timestamptz not null default now(),
  primary key (user_id, currency_id)
);

create table if not exists public.match3_currency_transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key text not null check (request_key ~ '^[A-Za-z0-9:_-]{1,120}$'),
  reason text not null check (char_length(btrim(reason)) between 1 and 120),
  request_changes jsonb not null,
  result_balances jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, request_key)
);

alter table public.match3_user_currencies enable row level security;
alter table public.match3_currency_transactions enable row level security;
revoke all on public.match3_user_currencies, public.match3_currency_transactions from public, anon, authenticated;

drop trigger if exists match3_user_currencies_updated_at on public.match3_user_currencies;
create trigger match3_user_currencies_updated_at before update on public.match3_user_currencies for each row execute function public.match3_set_updated_at();

create or replace function public.match3_currency_ids() returns text[]
language sql immutable parallel safe set search_path = pg_catalog, public as $$
  select array['gold','recruit_token','rarity_shard_r','rarity_shard_sr','rarity_shard_ssr','rarity_shard_ex']::text[];
$$;
revoke all on function public.match3_currency_ids() from public, anon, authenticated;

create or replace function public.match3_currency_balances(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = pg_catalog, public as $$
  select coalesce(jsonb_object_agg(ids.currency_id, coalesce(c.balance, 0) order by ids.currency_id), '{}'::jsonb)
  from unnest(public.match3_currency_ids()) ids(currency_id)
  left join public.match3_user_currencies c on c.user_id = p_user_id and c.currency_id = ids.currency_id;
$$;
revoke all on function public.match3_currency_balances(uuid) from public, anon, authenticated;

create or replace function public.match3_apply_currency_transaction(
  p_user_id uuid,
  p_request_key text,
  p_reason text,
  p_changes jsonb
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, auth as $$
declare
  existing public.match3_currency_transactions%rowtype;
  item jsonb;
  v_currency_id text;
  v_delta numeric;
  v_balance bigint;
  result_balances jsonb;
begin
  if not exists (select 1 from auth.users where id = p_user_id) then raise exception 'Unknown auth user'; end if;
  if p_request_key !~ '^[A-Za-z0-9:_-]{1,120}$' or char_length(btrim(p_reason)) not between 1 and 120 then raise exception 'INVALID_CURRENCY_TRANSACTION'; end if;
  if jsonb_typeof(p_changes) <> 'array' then raise exception 'INVALID_CURRENCY_TRANSACTION'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_request_key, 0));
  select * into existing from public.match3_currency_transactions where user_id = p_user_id and request_key = p_request_key;
  if found then
    if existing.request_changes <> p_changes or existing.reason <> p_reason then raise exception 'CURRENCY_REQUEST_CONFLICT'; end if;
    return jsonb_build_object('request_key', p_request_key, 'balances', existing.result_balances, 'applied', false);
  end if;

  insert into public.match3_user_currencies(user_id, currency_id, balance)
  select p_user_id, currency_id, 0 from unnest(public.match3_currency_ids()) currency_id on conflict do nothing;
  perform 1 from public.match3_user_currencies where user_id = p_user_id order by currency_id for update;

  for item in select value from jsonb_array_elements(p_changes) loop
    v_currency_id := item->>'currency_id';
    if not (v_currency_id = any(public.match3_currency_ids())) or jsonb_typeof(item->'delta') <> 'number' then raise exception 'INVALID_CURRENCY_CHANGE'; end if;
    v_delta := (item->>'delta')::numeric;
    if trunc(v_delta) <> v_delta or abs(v_delta) > 9007199254740991 then raise exception 'INVALID_CURRENCY_CHANGE'; end if;
    select balance into v_balance from public.match3_user_currencies where user_id = p_user_id and currency_id = v_currency_id;
    if v_balance + v_delta < 0 then raise exception 'INSUFFICIENT_CURRENCY'; end if;
    if v_balance + v_delta > 9007199254740991 then raise exception 'INVALID_CURRENCY_BALANCE'; end if;
    update public.match3_user_currencies set balance = (v_balance + v_delta)::bigint where user_id = p_user_id and currency_id = v_currency_id;
  end loop;

  result_balances := public.match3_currency_balances(p_user_id);
  insert into public.match3_currency_transactions(user_id, request_key, reason, request_changes, result_balances)
  values (p_user_id, p_request_key, p_reason, p_changes, result_balances);
  return jsonb_build_object('request_key', p_request_key, 'balances', result_balances, 'applied', true);
end;
$$;
revoke all on function public.match3_apply_currency_transaction(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.match3_apply_currency_transaction(uuid, text, text, jsonb) to service_role;

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
  insert into public.match3_user_currencies(user_id, currency_id, balance) select p_user_id, currency_id, 0 from unnest(public.match3_currency_ids()) currency_id on conflict do nothing;
  select jsonb_build_object(
    'profile', jsonb_build_object('display_name', p.display_name, 'created_at', p.created_at, 'updated_at', p.updated_at, 'last_seen_at', p.last_seen_at),
    'owned_character_ids', (select jsonb_agg(c.character_id order by c.character_id) from public.match3_user_characters c where c.user_id = p_user_id),
    'loadout', jsonb_build_object('combatant_character_id', l.combatant_character_id, 'support_character_id_1', l.support_character_id_1, 'support_character_id_2', l.support_character_id_2, 'loadout_version', l.loadout_version),
    'currencies', public.match3_currency_balances(p_user_id)
  ) into result from public.match3_profiles p join public.match3_user_loadouts l on l.user_id = p.user_id where p.user_id = p_user_id;
  return result;
end;
$$;
revoke all on function public.match3_bootstrap_user(uuid, text, text[], text, text, text) from public, anon, authenticated;
grant execute on function public.match3_bootstrap_user(uuid, text, text[], text, text, text) to service_role;
