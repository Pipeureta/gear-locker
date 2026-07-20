-- =============================================================================
-- Gear Locker — esquema Supabase
-- =============================================================================
-- Ejecutar completo en el SQL Editor de Supabase. Es seguro volver a
-- correrlo (todo usa if not exists / on conflict do nothing).
--
-- Modelo de acceso:
--   * Auth real de Supabase, con el correo personal de cada integrante
--     (sin correos sintéticos ni contraseñas guardadas a mano).
--   * Cada cuenta (auth.users) se vincula a una fila de players via user_id.
--   * Al registrarse, si el callsign coincide con un integrante ya cargado
--     y sin reclamar (user_id is null), la solicitud queda "matched": al
--     aprobarla, esa cuenta toma el lugar de esa ficha en vez de crear una
--     nueva.
--   * players.is_admin = true → comandancia (ve todo, edita cuotas/roles/notas).
--   * RLS garantiza que un jugador solo ve sus propias cuotas y nunca ve
--     admin_notes ajenas.
-- =============================================================================

-- ---------------------------------------------------------------- players

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  callsign text not null unique,
  name text not null,
  nickname text,
  rank text not null default 'Recluta',
  usual_role text not null default 'Rifleman',
  usual_roles text[] not null default array['Rifleman']::text[],
  is_admin boolean not null default false,
  joined_at date not null default current_date,
  phone text,
  photo_url text,
  status text not null default 'activo' check (status in ('activo', 'receso')),
  created_at timestamptz not null default now()
);

-- Solicitudes de ingreso: se crean al registrarse (auth.users) y comandancia
-- las aprueba creando la fila en players, o las rechaza eliminándolas.
create table if not exists public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete cascade,
  matched_player_id uuid references public.players (id) on delete set null,
  name text not null,
  callsign text not null,
  nickname text,
  phone text not null,
  photo_url text,
  requested_at timestamptz not null default now()
);

-- Compatibilidad si el esquema ya fue creado con una versión anterior.
alter table public.players add column if not exists nickname text;
alter table public.players add column if not exists usual_roles text[] not null default array['Rifleman']::text[];
alter table public.players add column if not exists primaries jsonb not null default '[]'::jsonb;
alter table public.players add column if not exists gear jsonb not null default '{}'::jsonb;
alter table public.players drop constraint if exists players_status_check;
alter table public.players add constraint players_status_check
  check (status in ('activo', 'receso', 'inactivo'));
alter table public.registration_requests
  add column if not exists matched_player_id uuid references public.players (id) on delete set null;
alter table public.registration_requests add column if not exists nickname text;

-- La recuperación de contraseña ahora la maneja Supabase Auth de forma
-- nativa (supabase.auth.resetPasswordForEmail), así que la tabla y el flujo
-- de aprobación manual que existían antes ya no hacen falta.
drop table if exists public.password_reset_requests;

-- Lista de equipo personal que administra comandancia. Cada integrante marca
-- lo que tiene en players.gear (jsonb: { "<item>": true }).
create table if not exists public.gear_checklist_items (
  name text primary key,
  created_at timestamptz not null default now()
);

-- Comprobantes de pago de cuotas (archivo en bucket privado 'receipts').
create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  storage_path text not null,
  filename text,
  status text not null default 'revision' check (status in ('revision', 'aceptado')),
  uploaded_at timestamptz not null default now()
);

-- La tabla `loadouts` (una réplica primaria por integrante) quedó reemplazada
-- por players.primaries (varias réplicas, cada una con su rol) y
-- players.gear (checklist). Se elimina si existía de una versión anterior.
drop table if exists public.loadouts;

-- ---------------------------------------------------------------- dues

create table if not exists public.dues (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  month text not null, -- 'YYYY-MM'
  amount integer not null,
  paid boolean not null default false,
  paid_at date,
  unique (player_id, month)
);

-- ---------------------------------------------------------------- events

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('MILSIM', 'Skirmish', 'Entrenamiento')),
  date date not null,
  start_time text not null default '09:00',
  location text not null,
  maps_query text,
  external_link text,
  description text,
  fps_limits jsonb not null default '[]', -- [{role, max}]
  reminders jsonb not null default '[]',  -- [string]
  created_at timestamptz not null default now()
);

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null check (status in ('va', 'no-va', 'tal-vez')),
  updated_at timestamptz not null default now(),
  primary key (event_id, player_id)
);

create table if not exists public.event_assignments (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  squad text not null,
  role text not null,
  primary key (event_id, player_id)
);

create table if not exists public.event_files (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  kind text not null default 'documento' check (kind in ('mapa', 'documento', 'imagen')),
  storage_path text not null, -- ruta en el bucket 'event-files'
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.comms_plan (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  channel text not null,
  channel_name text not null,
  rx_mhz text not null,
  tx_mhz text not null,
  rx_ctcss text not null default 'OFF',
  tx_ctcss text not null default 'OFF',
  scan_add text not null default 'ON',
  busylock text not null default 'OFF',
  wn_band text not null default 'Wide',
  power text not null default 'High',
  signal_code text not null default '1',
  notes text
);

-- Compatibilidad para instalaciones creadas con el plan de radio básico.
alter table public.comms_plan add column if not exists channel_name text;
alter table public.comms_plan add column if not exists rx_mhz text;
alter table public.comms_plan add column if not exists tx_mhz text;
alter table public.comms_plan add column if not exists rx_ctcss text default 'OFF';
alter table public.comms_plan add column if not exists tx_ctcss text default 'OFF';
alter table public.comms_plan add column if not exists scan_add text default 'ON';
alter table public.comms_plan add column if not exists busylock text default 'OFF';
alter table public.comms_plan add column if not exists wn_band text default 'Wide';
alter table public.comms_plan add column if not exists power text default 'High';
alter table public.comms_plan add column if not exists signal_code text default '1';

create table if not exists public.event_attendance (
  event_id uuid not null references public.events (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  attended boolean not null default true,
  primary key (event_id, player_id)
);

-- ---------------------------------------------------------------- admin

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  note text not null,
  author_id uuid references public.players (id),
  created_at timestamptz not null default now()
);

-- Inventario del equipo (hoja "Inventario" de la planilla)
create table if not exists public.team_inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  qty integer not null default 1,
  holder text not null default 'Bodega', -- bodega o integrante responsable
  note text,
  updated_at timestamptz not null default now()
);

-- Cotizaciones / adquisiciones pendientes
create table if not exists public.procurements (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  status text not null default 'Pendiente' check (status in ('Pendiente', 'Evaluando', 'Hecho')),
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info', 'warn', 'crit')),
  created_at timestamptz not null default now()
);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.players enable row level security;
alter table public.registration_requests enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.gear_checklist_items enable row level security;
alter table public.dues enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.event_assignments enable row level security;
alter table public.event_files enable row level security;
alter table public.comms_plan enable row level security;
alter table public.event_attendance enable row level security;
alter table public.admin_notes enable row level security;
alter table public.team_inventory enable row level security;
alter table public.procurements enable row level security;
alter table public.announcements enable row level security;

-- Helper: ¿el usuario actual es admin?
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select coalesce(
    (select is_admin from public.players where user_id = auth.uid()),
    false
  );
$$;

-- players: todos los autenticados ven el roster; solo admin edita; cada uno
-- puede editar su propio perfil (no is_admin/rank).
drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to authenticated using (true);
drop policy if exists players_admin_all on public.players;
create policy players_admin_all on public.players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists players_self_update on public.players;
create policy players_self_update on public.players
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_admin = (select is_admin from public.players where user_id = auth.uid()));

-- registration_requests: el solicitante crea y ve la suya; admin ve y borra todas.
drop policy if exists reg_self_insert on public.registration_requests;
create policy reg_self_insert on public.registration_requests
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists reg_self_select on public.registration_requests;
create policy reg_self_select on public.registration_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists reg_admin_delete on public.registration_requests;
create policy reg_admin_delete on public.registration_requests
  for delete to authenticated using (public.is_admin());

-- payment_receipts: cada uno sube y ve los suyos; admin ve todos y cambia estado.
drop policy if exists receipts_self_insert on public.payment_receipts;
create policy receipts_self_insert on public.payment_receipts
  for insert to authenticated
  with check (player_id in (select id from public.players where user_id = auth.uid()));
drop policy if exists receipts_select on public.payment_receipts;
create policy receipts_select on public.payment_receipts
  for select to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin());
drop policy if exists receipts_admin_update on public.payment_receipts;
create policy receipts_admin_update on public.payment_receipts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- gear_checklist_items: visible para todos; solo admin agrega o quita items.
drop policy if exists gear_items_select on public.gear_checklist_items;
create policy gear_items_select on public.gear_checklist_items
  for select to authenticated using (true);
drop policy if exists gear_items_admin on public.gear_checklist_items;
create policy gear_items_admin on public.gear_checklist_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- dues: cada jugador ve solo las suyas; admin ve y edita todas.
drop policy if exists dues_self_select on public.dues;
create policy dues_self_select on public.dues
  for select to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin());
drop policy if exists dues_admin_write on public.dues;
create policy dues_admin_write on public.dues
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- events + derivados: lectura para todos; escritura solo admin
-- (excepto el RSVP propio).
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated using (true);
drop policy if exists events_admin on public.events;
create policy events_admin on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists rsvps_select on public.event_rsvps;
create policy rsvps_select on public.event_rsvps for select to authenticated using (true);
drop policy if exists rsvps_self on public.event_rsvps;
create policy rsvps_self on public.event_rsvps
  for all to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin())
  with check (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin());

drop policy if exists assignments_select on public.event_assignments;
create policy assignments_select on public.event_assignments for select to authenticated using (true);
drop policy if exists assignments_admin on public.event_assignments;
create policy assignments_admin on public.event_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists files_select on public.event_files;
create policy files_select on public.event_files for select to authenticated using (true);
drop policy if exists files_admin on public.event_files;
create policy files_admin on public.event_files for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists comms_select on public.comms_plan;
create policy comms_select on public.comms_plan for select to authenticated using (true);
drop policy if exists comms_admin on public.comms_plan;
create policy comms_admin on public.comms_plan for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists attendance_select on public.event_attendance;
create policy attendance_select on public.event_attendance for select to authenticated using (true);
drop policy if exists attendance_admin on public.event_attendance;
create policy attendance_admin on public.event_attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- admin_notes: SOLO admin (ni siquiera el jugador aludido las ve).
drop policy if exists notes_admin on public.admin_notes;
create policy notes_admin on public.admin_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists inventory_select on public.team_inventory;
create policy inventory_select on public.team_inventory for select to authenticated using (true);
drop policy if exists inventory_admin on public.team_inventory;
create policy inventory_admin on public.team_inventory for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists procurements_select on public.procurements;
create policy procurements_select on public.procurements for select to authenticated using (true);
drop policy if exists procurements_admin on public.procurements;
create policy procurements_admin on public.procurements for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists ann_select on public.announcements;
create policy ann_select on public.announcements for select to authenticated using (true);
drop policy if exists ann_admin on public.announcements;
create policy ann_admin on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- Storage — buckets y políticas
-- =============================================================================
-- Convención de rutas: los archivos que sube cada integrante van en
-- "<user_id>/archivo", así la política solo compara el primer segmento de la
-- ruta con auth.uid() (storage.foldername(name))[1].

insert into storage.buckets (id, name, public)
values
  ('player-photos', 'player-photos', true),
  ('event-files', 'event-files', false),
  ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "player-photos select" on storage.objects;
create policy "player-photos select" on storage.objects
  for select using (bucket_id = 'player-photos');

drop policy if exists "player-photos write own" on storage.objects;
create policy "player-photos write own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'player-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "player-photos update own" on storage.objects;
create policy "player-photos update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'player-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "event-files select" on storage.objects;
create policy "event-files select" on storage.objects
  for select to authenticated using (bucket_id = 'event-files');

drop policy if exists "event-files admin write" on storage.objects;
create policy "event-files admin write" on storage.objects
  for insert to authenticated with check (bucket_id = 'event-files' and public.is_admin());

drop policy if exists "event-files admin delete" on storage.objects;
create policy "event-files admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'event-files' and public.is_admin());

drop policy if exists "receipts write own" on storage.objects;
create policy "receipts write own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "receipts select own or admin" on storage.objects;
create policy "receipts select own or admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- =============================================================================
-- Datos semilla — nómina real de Team Six Devgru
-- =============================================================================
-- Se insertan SIN user_id: cada integrante queda "por reclamar" hasta que se
-- registre en la app con su callsign y comandancia apruebe la solicitud
-- (o, para la primera cuenta admin, se vincule a mano — ver instrucciones).
-- on conflict (callsign) hace este bloque seguro de correr más de una vez.

insert into public.players (callsign, name, rank, status, usual_role, usual_roles, is_admin, joined_at)
values
  ('1B9',  'Integrante',   'Veterano', 'activo', 'Squad Leader',   array['Squad Leader'],   true,  '2021-02-01'),
  ('2B9',  'Integrante', 'Titular',  'activo', 'LMG',            array['LMG'],            false, '2024-02-01'),
  ('3B9',  'Integrante',  'Veterano', 'activo', 'Sniper',         array['Sniper'],         false, '2021-02-01'),
  ('4B9',  'Integrante', 'Veterano', 'activo', 'Rifleman',       array['Rifleman'],       false, '2021-02-01'),
  ('5B9',  'Integrante',  'Veterano', 'activo', 'Radio Operator', array['Radio Operator'], false, '2021-02-01'),
  ('6B9',  'Integrante',  'Veterano', 'receso', 'Rifleman',       array['Rifleman'],       false, '2021-02-01'),
  ('7B9',  'Integrante',  'Veterano', 'activo', 'DMR',            array['DMR'],            false, '2021-02-01'),
  ('8B9',  'Integrante', 'Titular',  'activo', 'Medic',          array['Medic'],          false, '2022-01-01'),
  ('9B9',  'Integrante',   'Titular',  'activo', 'Grenadier',      array['Grenadier'],      false, '2023-09-01'),
  ('10B9', 'Integrante', 'Veterano', 'activo', 'Team Leader',    array['Team Leader'],    false, '2021-02-01'),
  ('12B9', 'Integrante',  'Titular',  'activo', 'Squad Leader',   array['Squad Leader'],   true,  '2024-01-01'),
  ('13B9', 'Integrante',   'Nuevo',    'activo', 'Rifleman',       array['Rifleman'],       false, '2026-01-01'),
  ('14B9', 'Integrante',  'Nuevo',    'activo', 'Rifleman',       array['Rifleman'],       false, '2026-04-01')
on conflict (callsign) do nothing;

insert into public.gear_checklist_items (name) values
  ('Protección ocular full-seal'),
  ('Dead rag'),
  ('Radio'),
  ('Chaleco táctico / plate carrier'),
  ('Casco'),
  ('Uniforme del equipo'),
  ('Botiquín personal (IFAK)'),
  ('Hidratación (camelback)'),
  ('Baterías de repuesto'),
  ('Linterna')
on conflict (name) do nothing;
