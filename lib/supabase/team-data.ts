'use client';

// Notas de comandancia, inventario, cotizaciones y avisos: antes solo en
// localStorage. Las tablas ya existían en schema.sql, solo no estaban
// conectadas.

import { createClient } from '@/lib/supabase/client';
import type { Announcement, InventoryItem, Player, Procurement } from '@/lib/data';

// ---------------------------------------------------------------- notas

export async function fetchAdminNotes(players: Player[]): Promise<Record<string, string>> {
  const supaToLocal = new Map(players.filter((p) => p.supaId).map((p) => [p.supaId!, p.id]));
  const { data } = await createClient().from('admin_notes').select('player_id, note');
  const notes: Record<string, string> = {};
  (data ?? []).forEach((row) => {
    const localId = supaToLocal.get(row.player_id);
    if (localId) notes[localId] = row.note;
  });
  return notes;
}

export async function setAdminNoteRemote(playerSupaId: string, note: string): Promise<void> {
  await createClient().from('admin_notes').upsert({ player_id: playerSupaId, note }, { onConflict: 'player_id' });
}

export async function removeAdminNoteRemote(playerSupaId: string): Promise<void> {
  await createClient().from('admin_notes').delete().eq('player_id', playerSupaId);
}

// ---------------------------------------------------------------- avisos

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data } = await createClient().from('announcements').select('*').order('created_at', { ascending: false });
  return (data ?? []).map((a) => ({ id: a.id, title: a.title, body: a.body, severity: a.severity, date: a.created_at }));
}

export async function addAnnouncementRemote(a: Omit<Announcement, 'id' | 'date'>): Promise<Announcement | null> {
  const { data, error } = await createClient()
    .from('announcements')
    .insert({ title: a.title, body: a.body, severity: a.severity })
    .select('*')
    .single();
  if (error || !data) return null;
  return { id: data.id, title: data.title, body: data.body, severity: data.severity, date: data.created_at };
}

export async function updateAnnouncementRemote(id: string, patch: Partial<Announcement>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.body !== undefined) payload.body = patch.body;
  if (patch.severity !== undefined) payload.severity = patch.severity;
  await createClient().from('announcements').update(payload).eq('id', id);
}

export async function removeAnnouncementRemote(id: string): Promise<void> {
  await createClient().from('announcements').delete().eq('id', id);
}

// ---------------------------------------------------------------- inventario

export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data } = await createClient().from('team_inventory').select('name, qty, holder, note').order('name');
  return (data ?? []).map((i) => ({ name: i.name, qty: i.qty, holder: i.holder, note: i.note ?? undefined }));
}

export async function addInventoryItemRemote(item: InventoryItem): Promise<void> {
  await createClient().from('team_inventory').insert({ name: item.name, qty: item.qty, holder: item.holder, note: item.note ?? null });
}

export async function updateInventoryItemRemote(originalName: string, item: InventoryItem): Promise<void> {
  await createClient()
    .from('team_inventory')
    .update({ name: item.name, qty: item.qty, holder: item.holder, note: item.note ?? null })
    .eq('name', originalName);
}

export async function removeInventoryItemRemote(name: string): Promise<void> {
  await createClient().from('team_inventory').delete().eq('name', name);
}

// ---------------------------------------------------------------- cotizaciones

export async function fetchProcurements(): Promise<Procurement[]> {
  const { data } = await createClient().from('procurements').select('item, status').order('created_at', { ascending: false });
  return (data ?? []).map((p) => ({ item: p.item, status: p.status }));
}

export async function addProcurementRemote(item: Procurement): Promise<void> {
  await createClient().from('procurements').insert({ item: item.item, status: item.status });
}

export async function updateProcurementRemote(originalItem: string, item: Procurement): Promise<void> {
  await createClient().from('procurements').update({ item: item.item, status: item.status }).eq('item', originalItem);
}

export async function removeProcurementRemote(item: string): Promise<void> {
  await createClient().from('procurements').delete().eq('item', item);
}
