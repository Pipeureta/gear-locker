// Cliente Supabase para componentes de cliente ('use client').
// Usa la anon key (segura de exponer: el acceso real lo controla RLS
// en supabase/schema.sql).
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
