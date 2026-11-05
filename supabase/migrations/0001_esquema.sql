-- Simulador de Innovación · Esquema en Supabase (Postgres)
-- Cada tabla equivale a una hoja del libro de Google Sheets de la versión 2.5.
-- "fila" guarda las celdas de la fila en el mismo orden de columnas de la hoja (ver fuente/Db.gs, HOJAS).
-- Las fechas se guardan como {"$d": "ISO-8601"}.
-- sim_id, k1, k2 y ts son copias de columnas clave para filtrar sin leer la tabla completa.
-- Nadie accede a estas tablas desde internet: RLS activado, sin políticas, y sin privilegios para anon/authenticated.
-- Solo la Edge Function "api" (con la service role key) lee y escribe, a través de las funciones de abajo.

do $$
declare t text;
begin
  foreach t in array array['config','parametros','propiedades','simulaciones','equipos','integrantes','decisiones','estados',
                           'resultados','bitacora','evaluaciones','log','docentes','invitaciones','sesiones','intentos_login']
  loop
    execute format('create table if not exists public.%I (
      id bigserial primary key,
      sim_id text,
      k1 text,
      k2 integer,
      ts timestamptz,
      fila jsonb not null,
      creado timestamptz not null default now()
    )', t);
    execute format('create index if not exists %I on public.%I (sim_id)', t || '_sim_idx', t);
    execute format('create index if not exists %I on public.%I (k1, k2)', t || '_k_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create index if not exists sesiones_ts_idx on public.sesiones (ts);
create index if not exists intentos_login_ts_idx on public.intentos_login (ts);
create index if not exists log_ts_idx on public.log (ts);

create table if not exists public.bloqueos (
  nombre text primary key,
  token text not null,
  hasta timestamptz not null
);
alter table public.bloqueos enable row level security;
revoke all on public.bloqueos from anon, authenticated;

-- Lista blanca de tablas que pueden tocar las funciones dinámicas.
create or replace function public.sim_tabla_ok(p text) returns boolean
language sql immutable set search_path = '' as $$
  select p = any (array['config','parametros','propiedades','simulaciones','equipos','integrantes','decisiones','estados',
                        'resultados','bitacora','evaluaciones','log','docentes','invitaciones','sesiones','intentos_login'])
$$;

-- Carga varias tablas en una sola llamada.
-- p = [{ "tabla": "estados", "sim": "S01" | null, "k1": "..." | null, "desde": "ISO" | null,
--        "parcial": 3 | null (solo las 3 primeras celdas), "ids": [1,2] | null }]
-- Devuelve { "estados": [[id, fila], ...], ... } ordenado por id.
create or replace function public.sim_cargar(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  it jsonb; t text; sql text; res jsonb := '{}'::jsonb; filas jsonb; sel text;
begin
  -- limpieza ocasional de sesiones vencidas e intentos viejos
  if random() < 0.05 then
    delete from public.sesiones where ts < now();
    delete from public.intentos_login where ts < now() - interval '1 day';
  end if;
  for it in select * from jsonb_array_elements(p) loop
    t := it->>'tabla';
    if not public.sim_tabla_ok(t) then raise exception 'tabla no permitida: %', t; end if;
    if (it->>'parcial') is not null then
      sel := format('jsonb_build_array(id, (select jsonb_agg(e) from (select e from jsonb_array_elements(fila) with ordinality as x(e, n) where n <= %s order by n) q))', (it->>'parcial')::int);
    else
      sel := 'jsonb_build_array(id, fila)';
    end if;
    sql := format('select coalesce(jsonb_agg(%s order by id), ''[]''::jsonb) from public.%I where true', sel, t);
    if (it->>'sim') is not null then sql := sql || format(' and sim_id = %L', it->>'sim'); end if;
    if (it->>'k1') is not null then sql := sql || format(' and k1 = %L', it->>'k1'); end if;
    if (it->>'desde') is not null then sql := sql || format(' and ts >= %L::timestamptz', it->>'desde'); end if;
    if jsonb_typeof(it->'ids') = 'array' then
      sql := sql || format(' and id = any (%L::bigint[])', (select array_agg(x::bigint) from jsonb_array_elements_text(it->'ids') x));
    end if;
    execute sql into filas;
    res := jsonb_set(res, array[t], coalesce(res->t, '[]'::jsonb) || filas);
  end loop;
  return res;
end $$;

-- Aplica todos los cambios de una petición en una sola transacción.
-- p = [{ "tabla": "...", "op": "ins" | "upd" | "del", "id": 1, "sim_id": "S01", "k1": "...", "k2": 1, "ts": "ISO", "fila": [...] }]
create or replace function public.sim_aplicar(p jsonb) returns integer
language plpgsql set search_path = '' as $$
declare it jsonb; t text; n integer := 0;
begin
  for it in select * from jsonb_array_elements(p) loop
    t := it->>'tabla';
    if not public.sim_tabla_ok(t) then raise exception 'tabla no permitida: %', t; end if;
    if it->>'op' = 'ins' then
      execute format('insert into public.%I (sim_id, k1, k2, ts, fila) values ($1, $2, $3, $4, $5)', t)
        using it->>'sim_id', it->>'k1', (it->>'k2')::int, (it->>'ts')::timestamptz, it->'fila';
    elsif it->>'op' = 'upd' then
      execute format('update public.%I set sim_id = $1, k1 = $2, k2 = $3, ts = $4, fila = $5 where id = $6', t)
        using it->>'sim_id', it->>'k1', (it->>'k2')::int, (it->>'ts')::timestamptz, it->'fila', (it->>'id')::bigint;
    elsif it->>'op' = 'del' then
      execute format('delete from public.%I where id = $1', t) using (it->>'id')::bigint;
    else
      raise exception 'operación no válida';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Bloqueo con vencimiento (evita que dos peticiones modifiquen la misma simulación a la vez).
create or replace function public.sim_tomar_bloqueo(p_nombre text, p_token text, p_seg integer) returns boolean
language plpgsql set search_path = '' as $$
begin
  insert into public.bloqueos (nombre, token, hasta) values (p_nombre, p_token, now() + make_interval(secs => p_seg))
  on conflict (nombre) do update set token = excluded.token, hasta = excluded.hasta
    where public.bloqueos.hasta < now();
  return exists (select 1 from public.bloqueos where nombre = p_nombre and token = p_token);
end $$;

create or replace function public.sim_soltar_bloqueo(p_nombre text, p_token text) returns void
language sql set search_path = '' as $$
  delete from public.bloqueos where nombre = p_nombre and token = p_token
$$;

revoke all on function public.sim_tabla_ok(text) from public, anon, authenticated;
revoke all on function public.sim_cargar(jsonb) from public, anon, authenticated;
revoke all on function public.sim_aplicar(jsonb) from public, anon, authenticated;
revoke all on function public.sim_tomar_bloqueo(text, text, integer) from public, anon, authenticated;
revoke all on function public.sim_soltar_bloqueo(text, text) from public, anon, authenticated;
grant execute on function public.sim_tabla_ok(text) to service_role;
grant execute on function public.sim_cargar(jsonb) to service_role;
grant execute on function public.sim_aplicar(jsonb) to service_role;
grant execute on function public.sim_tomar_bloqueo(text, text, integer) to service_role;
grant execute on function public.sim_soltar_bloqueo(text, text) to service_role;
