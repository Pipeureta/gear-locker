'use client';

// Cuotas y comprobantes de pago: antes solo en localStorage (los
// comprobantes incluso como imagen base64 gigante en el navegador, sin
// subir nunca al bucket privado 'receipts' que ya existía). Ahora todo
// vive en Supabase (tablas dues / payment_receipts + bucket 'receipts').

import { createClient } from '@/lib/supabase/client';
import type { Due, Player } from '@/lib/data';
import type { Receipt } from '@/lib/store';

export async function fetchDues(players: Player[]): Promise<Due[]> {
  const supaToLocal = new Map(players.filter((p) => p.supaId).map((p) => [p.supaId!, p.id]));
  const { data } = await createClient().from('dues').select('player_id, month, amount, paid, paid_at');
  const dues: Due[] = [];
  (data ?? []).forEach((d) => {
    const playerId = supaToLocal.get(d.player_id);
    if (!playerId) return;
    dues.push({ playerId, month: d.month, amount: d.amount, paid: d.paid, paidAt: d.paid_at ?? undefined });
  });
  return dues;
}

export async function insertDuesRemote(rows: { playerSupaId: string; month: string; amount: number }[]): Promise<void> {
  if (rows.length === 0) return;
  await createClient()
    .from('dues')
    .upsert(
      rows.map((r) => ({ player_id: r.playerSupaId, month: r.month, amount: r.amount, paid: false })),
      { onConflict: 'player_id,month', ignoreDuplicates: true },
    );
}

export async function setDuePaidRemote(playerSupaId: string, month: string, paid: boolean): Promise<void> {
  await createClient()
    .from('dues')
    .update({ paid, paid_at: paid ? new Date().toISOString().slice(0, 10) : null })
    .eq('player_id', playerSupaId)
    .eq('month', month);
}

export async function fetchReceipts(players: Player[]): Promise<Receipt[]> {
  const supaToLocal = new Map(players.filter((p) => p.supaId).map((p) => [p.supaId!, p.id]));
  const { data } = await createClient()
    .from('payment_receipts')
    .select('id, player_id, month, storage_path, filename, status, uploaded_at')
    .order('uploaded_at', { ascending: false });
  const receipts: Receipt[] = [];
  (data ?? []).forEach((r) => {
    const playerId = supaToLocal.get(r.player_id);
    if (!playerId) return;
    receipts.push({
      id: r.id,
      playerId,
      month: r.month,
      storagePath: r.storage_path,
      filename: r.filename ?? '',
      uploadedAt: r.uploaded_at,
      status: r.status as 'revision' | 'aceptado',
    });
  });
  return receipts;
}

export async function uploadReceiptRemote(
  authUserId: string,
  playerSupaId: string,
  month: string,
  file: File,
): Promise<{ id: string; storagePath: string; uploadedAt: string } | null> {
  const supabase = createClient();
  const path = `${authUserId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
  const { error: upErr } = await supabase.storage.from('receipts').upload(path, file);
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabase
    .from('payment_receipts')
    .insert({ player_id: playerSupaId, month, storage_path: path, filename: file.name })
    .select('id, uploaded_at')
    .single();
  if (error || !data) return null;
  return { id: data.id as string, storagePath: path, uploadedAt: data.uploaded_at as string };
}

export async function getReceiptUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await createClient().storage.from('receipts').createSignedUrl(storagePath, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function acceptReceiptRemote(receiptId: string, playerSupaId: string, month: string): Promise<void> {
  const supabase = createClient();
  await Promise.all([
    supabase.from('payment_receipts').update({ status: 'aceptado' }).eq('id', receiptId),
    supabase
      .from('dues')
      .update({ paid: true, paid_at: new Date().toISOString().slice(0, 10) })
      .eq('player_id', playerSupaId)
      .eq('month', month),
  ]);
}

export async function fetchCollectionAdjustment(): Promise<number> {
  const { data } = await createClient().from('team_settings').select('collection_adjustment').eq('id', 1).maybeSingle();
  return data?.collection_adjustment ?? 0;
}

export async function setCollectionAdjustmentRemote(value: number): Promise<void> {
  await createClient().from('team_settings').update({ collection_adjustment: value }).eq('id', 1);
}
