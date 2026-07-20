import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Cliente con la service_role key: solo se usa en rutas server-only que
// corren sin sesión de usuario (el cron de recordatorios). Bypassa RLS a
// propósito — nunca importar esto desde código de cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}
