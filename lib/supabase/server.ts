// Cliente Supabase para Server Components / Route Handlers.
// Lee y escribe la sesión desde las cookies de Next.js.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // set() llamado desde un Server Component: se ignora porque el
            // middleware ya se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
