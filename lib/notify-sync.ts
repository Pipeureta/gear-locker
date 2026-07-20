'use client';

// Espeja lo mínimo de eventos/RSVPs hacia Supabase para que el cron de
// recordatorios (app/api/cron/reminders) sepa qué avisar y a quién. Los
// eventos en sí siguen viviendo en el store local — esto es solo el reflejo
// que el servidor necesita.

import { createClient } from '@/lib/supabase/client';
import type { GameEvent, RsvpStatus } from '@/lib/data';

export async function syncEventNotify(event: GameEvent) {
  const supabase = createClient();
  await supabase.from('event_notify').upsert({
    id: event.id,
    name: event.name,
    location: event.location,
    event_at: new Date(`${event.date}T${event.startTime}:00`).toISOString(),
  });
}

export async function removeEventNotify(eventId: string) {
  await createClient().from('event_notify').delete().eq('id', eventId);
}

export async function syncRsvp(eventId: string, userId: string, status: RsvpStatus) {
  await createClient().from('event_rsvp_sync').upsert({ event_id: eventId, user_id: userId, status });
}

export async function broadcastEventAnnouncement(event: GameEvent) {
  await fetch('/api/push/broadcast-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: event.id, name: event.name, date: event.date, startTime: event.startTime }),
  });
}
