-- =============================================================================
-- Gear Locker — esquema Supabase
-- =============================================================================
-- Ejecutar en el SQL Editor de Supabase (o via supabase db push).
-- Modelo de acceso:
--   * Cada usuario autenticado tiene una fila en players (vinculada a auth.users).
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

-- Compatibilidad si registration_requests ya fue creada con una versión
-- anterior del esquema.
alter table public.players add column if not exists nickname text;
alter table public.players add column if not exists usual_roles text[] not null default array['Rifleman']::text[];
alter table public.registration_requests
  add column if not exists matched_player_id uuid references public.players (id) on delete set null;
alter table public.registration_requests add column if not exists nickname text;

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'pendiente' check (status in ('pendiente', 'aprobada')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (player_id)
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

create table if not exists public.loadouts (
  player_id uuid primary key references public.players (id) on delete cascade,
  "primary" text,
  secondary text,
  fps integer,
  radio text,
  camo text,
  updated_at timestamptz not null default now()
);

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
alter table public.password_reset_requests enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.loadouts enable row level security;
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
create policy players_select on public.players
  for select to authenticated using (true);
create policy players_admin_all on public.players
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy players_self_update on public.players
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and is_admin = (select is_admin from public.players where user_id = auth.uid()));

-- registration_requests: el solicitante crea y ve la suya; admin ve y borra todas.
create policy reg_self_insert on public.registration_requests
  for insert to authenticated with check (user_id = auth.uid());
create policy reg_self_select on public.registration_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy reg_admin_delete on public.registration_requests
  for delete to authenticated using (public.is_admin());

-- Las solicitudes de recuperación se crean mediante una función de servidor
-- controlada; solo Comandancia puede leerlas, aprobarlas o rechazarlas.
create policy password_resets_admin on public.password_reset_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- payment_receipts: cada uno sube y ve los suyos; admin ve todos y cambia estado.
create policy receipts_self_insert on public.payment_receipts
  for insert to authenticated
  with check (player_id in (select id from public.players where user_id = auth.uid()));
create policy receipts_select on public.payment_receipts
  for select to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin());
create policy receipts_admin_update on public.payment_receipts
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- loadouts: visibles para todos; editables por el dueño o admin.
create policy loadouts_select on public.loadouts
  for select to authenticated using (true);
create policy loadouts_self on public.loadouts
  for all to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin())
  with check (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin());

-- dues: cada jugador ve solo las suyas; admin ve y edita todas.
create policy dues_self_select on public.dues
  for select to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin());
create policy dues_admin_write on public.dues
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- events + derivados: lectura para todos; escritura solo admin
-- (excepto el RSVP propio).
create policy events_select on public.events for select to authenticated using (true);
create policy events_admin on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy rsvps_select on public.event_rsvps for select to authenticated using (true);
create policy rsvps_self on public.event_rsvps
  for all to authenticated
  using (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin())
  with check (player_id in (select id from public.players where user_id = auth.uid()) or public.is_admin());

create policy assignments_select on public.event_assignments for select to authenticated using (true);
create policy assignments_admin on public.event_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy files_select on public.event_files for select to authenticated using (true);
create policy files_admin on public.event_files for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy comms_select on public.comms_plan for select to authenticated using (true);
create policy comms_admin on public.comms_plan for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy attendance_select on public.event_attendance for select to authenticated using (true);
create policy attendance_admin on public.event_attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- admin_notes: SOLO admin (ni siquiera el jugador aludido las ve).
create policy notes_admin on public.admin_notes for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy inventory_select on public.team_inventory for select to authenticated using (true);
create policy inventory_admin on public.team_inventory for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy procurements_select on public.procurements for select to authenticated using (true);
create policy procurements_admin on public.procurements for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy ann_select on public.announcements for select to authenticated using (true);
create policy ann_admin on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =============================================================================
-- Storage: crear bucket 'event-files' (privado) y 'player-photos' (público)
-- desde el dashboard, con políticas:
--   event-files:   select → authenticated; insert/delete → is_admin()
--   player-photos: select → public; insert/update → dueño o admin
-- =============================================================================
