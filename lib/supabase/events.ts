'use client';

// Eventos, RSVPs, asistencia y archivos ahora viven en Supabase (antes solo
// en localStorage del teléfono, lo que los hacía desaparecer si alguien
// borraba los datos del sitio o cambiaba de dispositivo). Los ids locales
// de los jugadores no siempre son el uuid real de Supabase (los del roster
// de ejemplo usan ids tipo '1b9'), así que acá se traduce usando
// player.supaId cuando hace falta.

import { createClient } from '@/lib/supabase/client';
import { fmtBytes } from '@/lib/img';
import type { Assignment, CommsChannel, GameEvent, Player, RsvpStatus, EventFile } from '@/lib/data';
import type { UploadedEventFile } from '@/lib/store';

interface EventRow {
  id: string;
  name: string;
  type: GameEvent['type'];
  date: string;
  start_time: string;
  location: string;
  maps_query: string | null;
  external_link: string | null;
  description: string | null;
  fps_limits: { role: string; max: number }[] | null;
  reminders: string[] | null;
}

export interface FetchedEventData {
  events: GameEvent[];
  rsvps: Record<string, Record<string, RsvpStatus>>;
  uploads: UploadedEventFile[];
  // eventId -> playerId -> item -> ¿lo tiene?
  gearStatus: Record<string, Record<string, Record<string, boolean>>>;
}

export async function fetchEventData(players: Player[]): Promise<FetchedEventData> {
  const supabase = createClient();
  const supaToLocal = new Map(players.filter((p) => p.supaId).map((p) => [p.supaId!, p.id]));

  const [eventsRes, assignmentsRes, commsRes, attendanceRes, rsvpsRes, filesRes, gearReqRes, gearStatusRes] = await Promise.all([
    supabase.from('events').select('*').order('date', { ascending: true }),
    supabase.from('event_assignments').select('event_id, player_id, squad, role'),
    supabase.from('comms_plan').select('*'),
    supabase.from('event_attendance').select('event_id, player_id'),
    supabase.from('event_rsvps').select('event_id, player_id, status'),
    supabase.from('event_files').select('*'),
    supabase.from('event_gear_requirements').select('event_id, item'),
    supabase.from('event_gear_status').select('event_id, player_id, item, checked'),
  ]);

  const eventRows = (eventsRes.data ?? []) as EventRow[];

  const events: GameEvent[] = eventRows.map((row) => {
    const assignments: Assignment[] = (assignmentsRes.data ?? [])
      .filter((a) => a.event_id === row.id)
      .map((a) => ({ playerId: supaToLocal.get(a.player_id) ?? a.player_id, squad: a.squad, role: a.role }));

    const comms: CommsChannel[] = (commsRes.data ?? [])
      .filter((c) => c.event_id === row.id)
      .map((c) => ({
        channel: c.channel,
        name: c.channel_name,
        rxMhz: c.rx_mhz,
        txMhz: c.tx_mhz,
        rxCtcss: c.rx_ctcss,
        txCtcss: c.tx_ctcss,
        scanAdd: c.scan_add,
        busylock: c.busylock,
        wnBand: c.wn_band,
        power: c.power,
        signalCode: c.signal_code,
        notes: c.notes ?? undefined,
      }));

    const attended = (attendanceRes.data ?? [])
      .filter((a) => a.event_id === row.id)
      .map((a) => supaToLocal.get(a.player_id))
      .filter((id): id is string => Boolean(id));

    const requiredGear = (gearReqRes.data ?? [])
      .filter((g) => g.event_id === row.id)
      .map((g) => g.item);

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      date: row.date,
      startTime: row.start_time,
      location: row.location,
      mapsQuery: row.maps_query ?? row.location,
      externalLink: row.external_link ?? undefined,
      description: row.description ?? '',
      fpsLimits: row.fps_limits ?? [],
      reminders: row.reminders ?? [],
      files: [] as EventFile[],
      comms,
      assignments,
      attended,
      requiredGear,
    };
  });

  const rsvps: Record<string, Record<string, RsvpStatus>> = {};
  (rsvpsRes.data ?? []).forEach((r) => {
    const localId = supaToLocal.get(r.player_id);
    if (!localId) return;
    rsvps[r.event_id] = { ...rsvps[r.event_id], [localId]: r.status as RsvpStatus };
  });

  const uploads: UploadedEventFile[] = (filesRes.data ?? []).map((f) => ({
    id: f.id,
    eventId: f.event_id,
    name: f.name,
    kind: f.kind,
    storagePath: f.storage_path,
    size: fmtBytes(f.size_bytes ?? 0),
    uploadedAt: f.created_at,
  }));

  const gearStatus: Record<string, Record<string, Record<string, boolean>>> = {};
  (gearStatusRes.data ?? []).forEach((g) => {
    const localId = supaToLocal.get(g.player_id);
    if (!localId) return;
    gearStatus[g.event_id] = gearStatus[g.event_id] ?? {};
    gearStatus[g.event_id][localId] = { ...gearStatus[g.event_id][localId], [g.item]: g.checked };
  });

  return { events, rsvps, uploads, gearStatus };
}

function toAssignmentRows(eventId: string, assignments: Assignment[], players: Player[]) {
  const localToSupa = new Map(players.filter((p) => p.supaId).map((p) => [p.id, p.supaId!]));
  return assignments
    .map((a) => ({ event_id: eventId, player_id: localToSupa.get(a.playerId), squad: a.squad, role: a.role }))
    .filter((row): row is { event_id: string; player_id: string; squad: string; role: Assignment['role'] } => Boolean(row.player_id));
}

function toCommsRows(eventId: string, comms: CommsChannel[]) {
  return comms.map((c) => ({
    event_id: eventId,
    channel: c.channel,
    channel_name: c.name ?? '',
    rx_mhz: c.rxMhz ?? '',
    tx_mhz: c.txMhz ?? '',
    rx_ctcss: c.rxCtcss ?? 'OFF',
    tx_ctcss: c.txCtcss ?? 'OFF',
    scan_add: c.scanAdd ?? 'ON',
    busylock: c.busylock ?? 'OFF',
    wn_band: c.wnBand ?? 'Wide',
    power: c.power ?? 'High',
    signal_code: c.signalCode ?? '1',
    notes: c.notes ?? null,
  }));
}

function toGearReqRows(eventId: string, requiredGear: string[]) {
  return requiredGear.map((item) => ({ event_id: eventId, item }));
}

export async function createEventRemote(draft: Omit<GameEvent, 'id'>, players: Player[]): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('events')
    .insert({
      name: draft.name,
      type: draft.type,
      date: draft.date,
      start_time: draft.startTime,
      location: draft.location,
      maps_query: draft.mapsQuery,
      external_link: draft.externalLink ?? null,
      description: draft.description,
      fps_limits: draft.fpsLimits,
      reminders: draft.reminders,
    })
    .select('id')
    .single();
  if (error || !data) {
    console.error('createEventRemote:', error?.message);
    return null;
  }

  const id = data.id as string;
  const assignmentRows = toAssignmentRows(id, draft.assignments, players);
  const commsRows = toCommsRows(id, draft.comms);
  const gearRows = toGearReqRows(id, draft.requiredGear);
  await Promise.all([
    assignmentRows.length ? supabase.from('event_assignments').insert(assignmentRows) : Promise.resolve(),
    commsRows.length ? supabase.from('comms_plan').insert(commsRows) : Promise.resolve(),
    gearRows.length ? supabase.from('event_gear_requirements').insert(gearRows) : Promise.resolve(),
  ]);
  return id;
}

export async function updateEventRemote(id: string, draft: Omit<GameEvent, 'id'>, players: Player[]): Promise<void> {
  const supabase = createClient();
  await supabase
    .from('events')
    .update({
      name: draft.name,
      type: draft.type,
      date: draft.date,
      start_time: draft.startTime,
      location: draft.location,
      maps_query: draft.mapsQuery,
      external_link: draft.externalLink ?? null,
      description: draft.description,
      fps_limits: draft.fpsLimits,
      reminders: draft.reminders,
    })
    .eq('id', id);

  await Promise.all([
    supabase.from('event_assignments').delete().eq('event_id', id),
    supabase.from('comms_plan').delete().eq('event_id', id),
    supabase.from('event_gear_requirements').delete().eq('event_id', id),
  ]);
  const assignmentRows = toAssignmentRows(id, draft.assignments, players);
  const commsRows = toCommsRows(id, draft.comms);
  const gearRows = toGearReqRows(id, draft.requiredGear);
  await Promise.all([
    assignmentRows.length ? supabase.from('event_assignments').insert(assignmentRows) : Promise.resolve(),
    commsRows.length ? supabase.from('comms_plan').insert(commsRows) : Promise.resolve(),
    gearRows.length ? supabase.from('event_gear_requirements').insert(gearRows) : Promise.resolve(),
  ]);
}

export async function deleteEventRemote(id: string): Promise<void> {
  await createClient().from('events').delete().eq('id', id);
}

export async function setRsvpRemote(eventId: string, playerSupaId: string, status: RsvpStatus): Promise<void> {
  await createClient().from('event_rsvps').upsert({ event_id: eventId, player_id: playerSupaId, status });
}

export async function setGearStatusRemote(eventId: string, playerSupaId: string, item: string, checked: boolean): Promise<void> {
  await createClient()
    .from('event_gear_status')
    .upsert({ event_id: eventId, player_id: playerSupaId, item, checked });
}

export async function setAttendanceRemote(eventId: string, playerSupaId: string, attended: boolean): Promise<void> {
  const supabase = createClient();
  if (attended) {
    await supabase.from('event_attendance').upsert({ event_id: eventId, player_id: playerSupaId, attended: true });
  } else {
    await supabase.from('event_attendance').delete().eq('event_id', eventId).eq('player_id', playerSupaId);
  }
}

export async function addFileRemote(
  eventId: string,
  file: { name: string; kind: string; storagePath: string; sizeBytes: number },
): Promise<{ id: string; uploadedAt: string } | null> {
  const { data, error } = await createClient()
    .from('event_files')
    .insert({ event_id: eventId, name: file.name, kind: file.kind, storage_path: file.storagePath, size_bytes: file.sizeBytes })
    .select('id, created_at')
    .single();
  if (error || !data) {
    console.error('addFileRemote:', error?.message);
    return null;
  }
  return { id: data.id as string, uploadedAt: data.created_at as string };
}

export async function removeFileRemote(fileId: string): Promise<void> {
  await createClient().from('event_files').delete().eq('id', fileId);
}
