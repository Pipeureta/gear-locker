import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { configureVapid, sendToSubscriptions } from '@/lib/push-server';

// Llamado por comandancia justo al crear un evento: manda el push de
// "nuevo evento" a todo el equipo. Usa la sesión del admin (no service
// role) — la policy de push_subscriptions ya permite que un admin lea
// todas las suscripciones.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const { data: me } = await supabase.from('players').select('is_admin').eq('user_id', user.id).maybeSingle();
  if (!me?.is_admin) return NextResponse.json({ error: 'Solo comandancia.' }, { status: 403 });

  const { eventId, name, date, startTime } = await request.json();
  if (!eventId || !name) return NextResponse.json({ error: 'Faltan datos del evento.' }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return NextResponse.json({ error: 'Faltan llaves VAPID en el servidor.' }, { status: 500 });
  }
  configureVapid();

  const { data: subs, error } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth_key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const sent = subs && subs.length > 0
    ? await sendToSubscriptions(supabase, subs, {
        title: '📅 Nuevo evento',
        body: `${name} — ${date} ${startTime ?? ''}`.trim(),
        url: `/eventos/${eventId}`,
      })
    : 0;

  await supabase.from('event_notify').update({ announced: true }).eq('id', eventId);

  return NextResponse.json({ ok: true, sent });
}
