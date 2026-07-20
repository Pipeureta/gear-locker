import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

export function configureVapid() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

// Manda el mismo push a varias suscripciones y borra las que ya vencieron
// (410/404). Usado por el anuncio de evento nuevo y por el cron de
// recordatorios — misma lógica de limpieza en ambos casos.
export async function sendToSubscriptions(
  supabase: SupabaseClient,
  subs: SubRow[],
  payload: { title: string; body: string; url?: string },
) {
  const staleIds: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) staleIds.push(s.id);
      }
    }),
  );
  if (staleIds.length > 0) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds);
  }
  return subs.length - staleIds.length;
}
