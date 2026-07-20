import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { configureVapid, sendToSubscriptions } from '@/lib/push-server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return NextResponse.json({ error: 'Faltan llaves VAPID en el servidor.' }, { status: 500 });
  }
  configureVapid();

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth_key')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) {
    return NextResponse.json({ error: 'No tienes notificaciones activadas en este dispositivo.' }, { status: 400 });
  }

  const sent = await sendToSubscriptions(supabase, subs, {
    title: 'Gear Locker',
    body: 'Notificación de prueba — si ves esto, funcionan. ✔',
    url: '/',
  });
  if (sent === 0) {
    return NextResponse.json({ error: 'La suscripción venció. Vuelve a activar las notificaciones.' }, { status: 410 });
  }

  return NextResponse.json({ ok: true, sent });
}
