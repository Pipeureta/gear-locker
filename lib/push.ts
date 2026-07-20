'use client';

// Suscripción a notificaciones push desde el navegador. El service worker
// (public/sw.js) ya está registrado por AppShell; acá solo pedimos permiso,
// obtenemos la PushSubscription del navegador y la guardamos en Supabase
// vía /api/push/subscribe.

function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(): Promise<{ error: string | null }> {
  if (!pushSupported()) return { error: 'Este navegador no soporta notificaciones push.' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { error: 'Permiso de notificaciones denegado.' };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) return { error: 'Falta configurar la llave VAPID pública.' };

  const reg = await navigator.serviceWorker.ready;
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || 'No se pudo guardar la suscripción.' };
  }
  return { error: null };
}

export async function sendTestPush(): Promise<{ error: string | null }> {
  const res = await fetch('/api/push/send-test', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: body.error || 'No se pudo enviar la notificación.' };
  }
  return { error: null };
}
