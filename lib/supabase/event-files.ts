'use client';

// Subida real de archivos/fotos de eventos al bucket privado 'event-files'
// de Supabase Storage. Reemplaza el modo demo anterior (base64 en
// localStorage, limitado a 2 MB). El bucket es privado, así que la
// visualización/descarga usa URLs firmadas con vencimiento.

import { createClient } from '@/lib/supabase/client';

export const MAX_EVENT_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

export async function uploadEventFile(
  eventId: string,
  file: File,
): Promise<{ path: string }> {
  if (file.size > MAX_EVENT_FILE_BYTES) {
    throw new Error('El archivo pesa más de 50 MB. Comprímelo o divídelo antes de subirlo.');
  }
  const supabase = createClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${eventId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('event-files').upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);
  return { path };
}

export async function getEventFileUrl(path: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from('event-files').createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

export async function getEventFileUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase.storage.from('event-files').createSignedUrls(paths, 60 * 60);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((row) => {
    if (row.signedUrl && !row.error) map[row.path ?? ''] = row.signedUrl;
  });
  return map;
}

export async function removeEventFileFromStorage(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from('event-files').remove([path]);
}
