-- =====================================================================
-- Lista de Turno · esquema, seguridad (RLS) y funciones
-- Zona horaria del negocio: America/Bogota
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Utilidades de fecha
-- ---------------------------------------------------------------------

-- "Hoy" según la hora de Bogotá (no la del servidor ni la del celular).
create or replace function public.hoy()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Bogota')::date
$$;

create or replace function public.fecha_bogota(p_ts timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_ts at time zone 'America/Bogota')::date
$$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table public.empleados (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null check (char_length(btrim(nombre)) between 1 and 40),
  activo     boolean not null default true,
  creado_en  timestamptz not null default now()
);

-- No puede haber dos empleados activos con el mismo nombre (se eligen por nombre).
create unique index empleados_nombre_activo_unico
  on public.empleados (lower(btrim(nombre)))
  where activo;

-- El PIN vive aparte y sin ninguna política: ningún cliente lo puede leer.
-- Se guarda con bcrypt, nunca en texto plano.
create table public.empleados_pin (
  empleado_id        uuid primary key references public.empleados (id) on delete cascade,
  pin_hash           text not null,
  intentos_fallidos  integer not null default 0,
  bloqueado_hasta    timestamptz
);

-- Cuentas de Supabase Auth (correo + contraseña) con permisos de administrador.
create table public.administradores (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  nombre   text not null default 'Administrador'
);

-- Cada celular de empleado tiene una sesión anónima de Supabase Auth
-- que queda vinculada a un empleado después de escribir su PIN.
create table public.sesiones_empleado (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  empleado_id  uuid not null references public.empleados (id) on delete cascade,
  creado_en    timestamptz not null default now()
);

create index sesiones_empleado_empleado_idx on public.sesiones_empleado (empleado_id);

create table public.tareas (
  id          uuid primary key default gen_random_uuid(),
  rol         text not null check (rol in ('taquero', 'tortillero', 'auxiliar', 'cajero')),
  bloque      text not null check (bloque in ('apertura', 'servicio', 'cierre')),
  texto       text not null check (char_length(btrim(texto)) between 1 and 200),
  orden       integer not null default 0,
  creado_por  text not null default 'Sistema',
  creado_en   timestamptz not null default now(),
  -- Las tareas quitadas no se borran: así el historial conserva sus totales.
  borrada_en  timestamptz
);

create index tareas_rol_bloque_idx on public.tareas (rol, bloque, orden) where borrada_en is null;

-- Una fila por día confirmado. roles = { "taquero": { "empleado_id": "...", "nombre": "..." } | null, ... }
create table public.asignaciones (
  fecha            date primary key,
  roles            jsonb not null default '{}'::jsonb,
  definido_por     text not null,
  definido_por_id  uuid,
  definido_en      timestamptz not null default now()
);

create table public.marcas (
  id           uuid primary key default gen_random_uuid(),
  fecha        date not null default public.hoy(),
  -- null cuando marca el administrador
  empleado_id  uuid references public.empleados (id) on delete set null,
  -- copia del nombre para que el historial lo conserve
  nombre       text not null,
  tarea_id     uuid not null references public.tareas (id) on delete cascade,
  rol          text not null check (rol in ('taquero', 'tortillero', 'auxiliar', 'cajero')),
  hora         timestamptz not null default now(),
  user_id      uuid
);

-- Única por persona + tarea + fecha.
create unique index marcas_unica
  on public.marcas (fecha, coalesce(empleado_id, '00000000-0000-0000-0000-000000000000'::uuid), tarea_id);
create index marcas_fecha_idx on public.marcas (fecha, rol);

-- ---------------------------------------------------------------------
-- Quién es quién
-- ---------------------------------------------------------------------

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.administradores a where a.user_id = auth.uid())
$$;

create or replace function public.mi_empleado_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select s.empleado_id
  from public.sesiones_empleado s
  join public.empleados e on e.id = s.empleado_id
  where s.user_id = auth.uid() and e.activo
$$;

create or replace function public.es_miembro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.es_admin() or public.mi_empleado_id() is not null
$$;

create or replace function public.exigir_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin() then
    raise exception 'Solo el administrador puede hacer esto.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.exigir_miembro()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_miembro() then
    raise exception 'Tu sesión no es válida. Vuelve a entrar.' using errcode = '42501';
  end if;
end;
$$;

-- Nombre de quien está usando la app (administrador o empleado).
create or replace function public.mi_nombre()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select a.nombre from public.administradores a where a.user_id = auth.uid()),
    (select e.nombre from public.empleados e where e.id = public.mi_empleado_id())
  )
$$;

-- ---------------------------------------------------------------------
-- Row Level Security: todos los miembros leen; nadie escribe directo.
-- Toda escritura pasa por las funciones de abajo, que validan permisos.
-- ---------------------------------------------------------------------

alter table public.empleados          enable row level security;
alter table public.empleados_pin      enable row level security;
alter table public.administradores    enable row level security;
alter table public.sesiones_empleado  enable row level security;
alter table public.tareas             enable row level security;
alter table public.asignaciones       enable row level security;
alter table public.marcas             enable row level security;

create policy "miembros leen empleados"    on public.empleados    for select to authenticated using (public.es_miembro());
create policy "miembros leen tareas"       on public.tareas       for select to authenticated using (public.es_miembro());
create policy "miembros leen asignaciones" on public.asignaciones for select to authenticated using (public.es_miembro());
create policy "miembros leen marcas"       on public.marcas       for select to authenticated using (public.es_miembro());
-- empleados_pin, administradores y sesiones_empleado: sin políticas = sin acceso.

grant usage on schema public to anon, authenticated;
grant select on public.empleados, public.tareas, public.asignaciones, public.marcas to authenticated;

revoke insert, update, delete, truncate on
  public.empleados, public.empleados_pin, public.administradores,
  public.sesiones_empleado, public.tareas, public.asignaciones, public.marcas
from anon, authenticated;
revoke select on public.empleados_pin, public.administradores, public.sesiones_empleado from anon, authenticated;

-- ---------------------------------------------------------------------
-- Inicio de sesión de empleados (nombre + PIN)
-- ---------------------------------------------------------------------

-- Lista de nombres para la pantalla de entrada (sin PIN, claro).
create or replace function public.lista_empleados_login()
returns table (id uuid, nombre text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.nombre from public.empleados e where e.activo order by lower(e.nombre)
$$;

-- Vincula la sesión anónima de este celular con el empleado si el PIN es correcto.
-- Devuelve json en vez de lanzar error para que el conteo de intentos sí se guarde.
create or replace function public.iniciar_sesion_empleado(p_empleado_id uuid, p_pin text)
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_emp record;
  v_intentos integer;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'No hay sesión en este dispositivo. Recarga la app.');
  end if;

  select e.id, e.nombre, p.pin_hash, p.intentos_fallidos, p.bloqueado_hasta
    into v_emp
  from public.empleados e
  join public.empleados_pin p on p.empleado_id = e.id
  where e.id = p_empleado_id and e.activo
  for update of p;

  if not found then
    return json_build_object('ok', false, 'error', 'Ese empleado ya no está en el equipo.');
  end if;

  if v_emp.bloqueado_hasta is not null and v_emp.bloqueado_hasta > now() then
    return json_build_object('ok', false, 'error',
      format('Demasiados intentos. Espera %s min o pide al administrador que restablezca tu PIN.',
             ceil(extract(epoch from v_emp.bloqueado_hasta - now()) / 60)::int));
  end if;

  if p_pin is null or v_emp.pin_hash <> extensions.crypt(p_pin, v_emp.pin_hash) then
    v_intentos := v_emp.intentos_fallidos + 1;
    if v_intentos >= 5 then
      update public.empleados_pin
        set intentos_fallidos = 0, bloqueado_hasta = now() + interval '10 minutes'
        where empleado_id = v_emp.id;
      return json_build_object('ok', false, 'error',
        'PIN incorrecto 5 veces. Espera 10 min o pide al administrador que lo restablezca.');
    end if;
    update public.empleados_pin set intentos_fallidos = v_intentos where empleado_id = v_emp.id;
    return json_build_object('ok', false, 'error',
      case when 5 - v_intentos = 1 then 'PIN incorrecto. Te queda 1 intento.'
           else format('PIN incorrecto. Te quedan %s intentos.', 5 - v_intentos) end);
  end if;

  update public.empleados_pin
    set intentos_fallidos = 0, bloqueado_hasta = null
    where empleado_id = v_emp.id;

  insert into public.sesiones_empleado (user_id, empleado_id)
  values (v_uid, v_emp.id)
  on conflict (user_id) do update set empleado_id = excluded.empleado_id, creado_en = now();

  return json_build_object('ok', true, 'id', v_emp.id, 'nombre', v_emp.nombre);
end;
$$;

create or replace function public.cerrar_sesion_empleado()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.sesiones_empleado where user_id = auth.uid()
$$;

-- Perfil de quien usa la app.
create or replace function public.mi_perfil()
returns json
language sql
stable
security definer
set search_path = ''
as $$
  select json_build_object(
    'admin', public.es_admin(),
    'nombre', public.mi_nombre(),
    'empleado_id', public.mi_empleado_id(),
    'hoy', public.hoy()
  )
$$;

-- ---------------------------------------------------------------------
-- Equipo (solo administrador)
-- ---------------------------------------------------------------------

create or replace function public.validar_pin(p_pin text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'El PIN debe tener exactamente 4 dígitos.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.crear_empleado(p_nombre text, p_pin text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.exigir_admin();
  perform public.validar_pin(p_pin);
  if exists (select 1 from public.empleados where activo and lower(btrim(nombre)) = lower(btrim(p_nombre))) then
    raise exception 'Ya hay alguien en el equipo llamado %.', btrim(p_nombre) using errcode = '23505';
  end if;

  insert into public.empleados (nombre) values (btrim(p_nombre)) returning id into v_id;
  insert into public.empleados_pin (empleado_id, pin_hash)
  values (v_id, extensions.crypt(p_pin, extensions.gen_salt('bf')));
  return v_id;
end;
$$;

-- Cambia el nombre y, si se envía, el PIN. Cambiar el PIN cierra las sesiones abiertas de esa persona.
create or replace function public.actualizar_empleado(p_id uuid, p_nombre text, p_pin text default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  if not exists (select 1 from public.empleados where id = p_id and activo) then
    raise exception 'Ese empleado ya no está en el equipo.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.empleados
             where activo and id <> p_id and lower(btrim(nombre)) = lower(btrim(p_nombre))) then
    raise exception 'Ya hay alguien en el equipo llamado %.', btrim(p_nombre) using errcode = '23505';
  end if;

  update public.empleados set nombre = btrim(p_nombre) where id = p_id;

  if p_pin is not null and p_pin <> '' then
    perform public.validar_pin(p_pin);
    update public.empleados_pin
      set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
          intentos_fallidos = 0,
          bloqueado_hasta = null
      where empleado_id = p_id;
    delete from public.sesiones_empleado where empleado_id = p_id;
  end if;
end;
$$;

-- Quitar = desactivar. El historial (asignaciones y marcas) conserva su nombre.
create or replace function public.quitar_empleado(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  update public.empleados set activo = false where id = p_id;
  delete from public.sesiones_empleado where empleado_id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Distribución del día (solo administrador)
-- ---------------------------------------------------------------------

-- p_roles: { "taquero": "<empleado_id>" | null, "tortillero": ..., "auxiliar": ..., "cajero": ... }
create or replace function public.guardar_distribucion(p_roles jsonb, p_fecha date default null)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fecha date := coalesce(p_fecha, public.hoy());
  v_rol text;
  v_id uuid;
  v_nombre text;
  v_roles jsonb := '{}'::jsonb;
begin
  perform public.exigir_admin();
  if v_fecha > public.hoy() then
    raise exception 'No se puede definir la distribución de un día que no ha llegado.' using errcode = '22023';
  end if;

  foreach v_rol in array array['taquero', 'tortillero', 'auxiliar', 'cajero'] loop
    v_id := nullif(p_roles ->> v_rol, '')::uuid;
    if v_id is null then
      v_roles := v_roles || jsonb_build_object(v_rol, null);
    else
      -- Hoy solo se asigna gente activa; al corregir días pasados vale cualquiera que haya existido.
      select e.nombre into v_nombre
      from public.empleados e
      where e.id = v_id and (e.activo or v_fecha < public.hoy());
      if not found then
        raise exception 'La persona elegida para % ya no está en el equipo.', v_rol using errcode = 'P0002';
      end if;
      v_roles := v_roles || jsonb_build_object(v_rol, jsonb_build_object('empleado_id', v_id, 'nombre', v_nombre));
    end if;
  end loop;

  insert into public.asignaciones (fecha, roles, definido_por, definido_por_id, definido_en)
  values (v_fecha, v_roles, public.mi_nombre(), auth.uid(), now())
  on conflict (fecha) do update
    set roles = excluded.roles,
        definido_por = excluded.definido_por,
        definido_por_id = excluded.definido_por_id,
        definido_en = excluded.definido_en;
end;
$$;

-- ---------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------

-- Cualquier miembro puede agregar tareas.
create or replace function public.agregar_tarea(p_rol text, p_bloque text, p_texto text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_orden integer;
begin
  perform public.exigir_miembro();
  if char_length(btrim(coalesce(p_texto, ''))) = 0 then
    raise exception 'Escribe la tarea.' using errcode = '22023';
  end if;

  select coalesce(max(orden), 0) + 1 into v_orden
  from public.tareas
  where rol = p_rol and bloque = p_bloque and borrada_en is null;

  insert into public.tareas (rol, bloque, texto, orden, creado_por)
  values (p_rol, p_bloque, btrim(p_texto), v_orden, coalesce(public.mi_nombre(), 'Equipo'))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.editar_tarea(p_id uuid, p_texto text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  if char_length(btrim(coalesce(p_texto, ''))) = 0 then
    raise exception 'Escribe la tarea.' using errcode = '22023';
  end if;
  update public.tareas set texto = btrim(p_texto) where id = p_id and borrada_en is null;
end;
$$;

create or replace function public.quitar_tarea(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform public.exigir_admin();
  update public.tareas set borrada_en = now() where id = p_id and borrada_en is null;
end;
$$;

-- ---------------------------------------------------------------------
-- Marcas
-- ---------------------------------------------------------------------

-- Marca o desmarca una tarea de hoy a nombre de quien inició sesión.
-- Un empleado solo marca tareas del puesto que cubre hoy (o de un puesto sin asignar)
-- y solo desmarca sus propias marcas.
create or replace function public.marcar_tarea(p_tarea_id uuid, p_hecha boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hoy date := public.hoy();
  v_admin boolean := public.es_admin();
  v_emp uuid := public.mi_empleado_id();
  v_tarea record;
  v_roles jsonb;
  v_asignado jsonb;
  v_otra record;
begin
  if not v_admin and v_emp is null then
    raise exception 'Tu sesión no es válida. Vuelve a entrar.' using errcode = '42501';
  end if;

  select t.id, t.rol into v_tarea from public.tareas t where t.id = p_tarea_id and t.borrada_en is null;
  if not found then
    raise exception 'Esa tarea ya no existe.' using errcode = 'P0002';
  end if;

  if not p_hecha then
    delete from public.marcas m
    where m.fecha = v_hoy and m.tarea_id = p_tarea_id
      and (v_admin or m.empleado_id = v_emp);
    return;
  end if;

  if not v_admin then
    -- Distribución vigente: la de hoy o, si no hay, la del último día guardado.
    select a.roles into v_roles
    from public.asignaciones a
    where a.fecha <= v_hoy
    order by a.fecha desc
    limit 1;

    v_asignado := v_roles -> v_tarea.rol;
    if v_asignado is not null and jsonb_typeof(v_asignado) = 'object'
       and (v_asignado ->> 'empleado_id')::uuid <> v_emp then
      raise exception 'Hoy este puesto lo cubre %. Solo esa persona marca sus tareas.', v_asignado ->> 'nombre'
        using errcode = '42501';
    end if;
  end if;

  select m.nombre into v_otra
  from public.marcas m
  where m.fecha = v_hoy and m.tarea_id = p_tarea_id
    and m.empleado_id is distinct from (case when v_admin then null else v_emp end)
  limit 1;
  if found then
    raise exception 'Esta tarea ya la marcó %.', v_otra.nombre using errcode = '23505';
  end if;

  insert into public.marcas (fecha, empleado_id, nombre, tarea_id, rol, hora, user_id)
  values (v_hoy, case when v_admin then null else v_emp end, public.mi_nombre(),
          p_tarea_id, v_tarea.rol, now(), auth.uid())
  on conflict do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Historial: avance por día y puesto
-- ---------------------------------------------------------------------

create or replace function public.resumen_historial(p_desde date, p_hasta date)
returns table (fecha date, rol text, total integer, hechas integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exigir_miembro();
  return query
  with dias as (
    select a.fecha from public.asignaciones a where a.fecha between p_desde and p_hasta
    union
    select m.fecha from public.marcas m where m.fecha between p_desde and p_hasta
    union
    select public.hoy() where public.hoy() between p_desde and p_hasta
  ),
  roles (rol) as (values ('taquero'), ('tortillero'), ('auxiliar'), ('cajero')),
  vigentes as (
    -- tareas que existían ese día
    select d.fecha, t.id, t.rol
    from dias d
    join public.tareas t
      on public.fecha_bogota(t.creado_en) <= d.fecha
     and (t.borrada_en is null or public.fecha_bogota(t.borrada_en) > d.fecha)
  )
  select d.fecha, r.rol,
    (select count(*) from vigentes v where v.fecha = d.fecha and v.rol = r.rol)::integer,
    (select count(distinct m.tarea_id)
       from public.marcas m
       join vigentes v on v.id = m.tarea_id and v.fecha = d.fecha
      where m.fecha = d.fecha and m.rol = r.rol)::integer
  from dias d
  cross join roles r
  order by d.fecha desc;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.hoy() to anon, authenticated;
grant execute on function public.fecha_bogota(timestamptz) to authenticated;
grant execute on function public.lista_empleados_login() to anon, authenticated;
grant execute on function
  public.es_admin(), public.mi_empleado_id(), public.es_miembro(), public.mi_nombre(),
  public.exigir_admin(), public.exigir_miembro(), public.validar_pin(text),
  public.iniciar_sesion_empleado(uuid, text), public.cerrar_sesion_empleado(), public.mi_perfil(),
  public.crear_empleado(text, text), public.actualizar_empleado(uuid, text, text), public.quitar_empleado(uuid),
  public.guardar_distribucion(jsonb, date),
  public.agregar_tarea(text, text, text), public.editar_tarea(uuid, text), public.quitar_tarea(uuid),
  public.marcar_tarea(uuid, boolean), public.resumen_historial(date, date)
to authenticated;

-- ---------------------------------------------------------------------
-- Tiempo real
-- ---------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table
  public.empleados, public.tareas, public.asignaciones, public.marcas;
