import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { configureVapid, sendToSubscriptions } from '@/lib/push-server';

// Corre cada hora (vercel.json). Vercel firma la llamada con
// Authorization: Bearer $CRON_SECRET automáticamente si esa env var existe.
export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  configureVapid();
  const supabase = createAdminClient();
  const now = Date.now();

  const { data: events, error } = await supabase
    .from('event_notify')
    .select('id, name, location, event_at, reminded_5d, reminded_2d, reminded_3h')
    .gt('event_at', new Date().toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let totalSent = 0;

  for (const ev of events ?? []) {
    const hoursLeft = (new Date(ev.event_at).getTime() - now) / 3_600_000;

    const fireNonResponders = async (flag: 'reminded_5d' | 'reminded_2d', label: string) => {
      const { data: responded } = await supabase.from('event_rsvp_sync').select('user_id').eq('event_id', ev.id);
      const respondedIds = new Set((responded ?? []).map((r) => r.user_id));
      const { data: subs } = await supabase.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth_key');
      const targets = (subs ?? []).filter((s) => !respondedIds.has(s.user_id));
      if (targets.length > 0) {
        totalSent += await sendToSubscriptions(supabase, targets, {
          title: '❓ ¿Vas a este evento?',
          body: `${ev.name} — quedan ${label}. Responde en la app.`,
          url: `/eventos/${ev.id}`,
        });
      }
      await supabase.from('event_notify').update({ [flag]: true }).eq('id', ev.id);
    };

    if (hoursLeft <= 120 && !ev.reminded_5d) await fireNonResponders('reminded_5d', '5 días');
    if (hoursLeft <= 48 && !ev.reminded_2d) await fireNonResponders('reminded_2d', '2 días');

    if (hoursLeft <= 3 && !ev.reminded_3h) {
      const { data: going } = await supabase.from('event_rsvp_sync').select('user_id').eq('event_id', ev.id).eq('status', 'va');
      const goingIds = (going ?? []).map((r) => r.user_id);
      if (goingIds.length > 0) {
        const { data: subs } = await supabase
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth_key')
          .in('user_id', goingIds);
        if (subs && subs.length > 0) {
          totalSent += await sendToSubscriptions(supabase, subs, {
            title: '⏰ Empieza pronto',
            body: `${ev.name} empieza en 3 horas${ev.location ? ' — ' + ev.location : ''}.`,
            url: `/eventos/${ev.id}`,
          });
        }
      }
      await supabase.from('event_notify').update({ reminded_3h: true }).eq('id', ev.id);
    }
  }

  return NextResponse.json({ ok: true, checked: events?.length ?? 0, sent: totalSent });
}
