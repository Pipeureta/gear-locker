'use client';

// Autenticación real contra Supabase: sesión, ficha del integrante (players)
// y el flujo de registro/"reclamo" de una ficha ya cargada por callsign.
//
// Reemplaza el login simulado que vivía en lib/store.tsx. El resto de la app
// (cuotas, eventos, inventario, avisos) sigue en modo local por ahora — ver
// README para el alcance de esta fase de la migración.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Role } from '@/lib/data';

export interface SupaPlayerRow {
  id: string;
  user_id: string;
  callsign: string;
  name: string;
  nickname: string | null;
  rank: string;
  usual_role: string;
  usual_roles: string[] | null;
  is_admin: boolean;
  joined_at: string;
  phone: string | null;
  photo_url: string | null;
  status: string;
  primaries: { name: string; role: Role }[] | null;
  gear: Record<string, boolean> | null;
}

export interface PendingRegistration {
  id: string;
  name: string;
  callsign: string;
  matched_player_id: string | null;
}

type AuthStatus = 'loading' | 'signed-out' | 'pending' | 'active';

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  callsign: string;
  nickname?: string;
  phone: string;
  photoFile?: File;
}

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  authUser: User | null;
  supaPlayer: SupaPlayerRow | null;
  pendingRequest: PendingRegistration | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  register: (input: RegisterInput) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  refreshPlayer: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

function translateAuthError(message: string): string {
  if (/already registered|already exists/i.test(message)) {
    return 'Ya existe una cuenta con ese correo. Prueba iniciar sesión o recuperar tu contraseña.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Correo o contraseña incorrectos.';
  }
  if (/password.*(least|short|6 characters)/i.test(message)) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (/email.*invalid/i.test(message)) {
    return 'Ese correo no parece válido.';
  }
  return message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [supaPlayer, setSupaPlayer] = useState<SupaPlayerRow | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRegistration | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data: playerRow } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (playerRow) {
      setSupaPlayer(playerRow as SupaPlayerRow);
      setPendingRequest(null);
      setStatus('active');
      return;
    }

    const { data: reqRow } = await supabase
      .from('registration_requests')
      .select('id, name, callsign, matched_player_id')
      .eq('user_id', userId)
      .maybeSingle();

    setSupaPlayer(null);
    setPendingRequest((reqRow as PendingRegistration) ?? null);
    setStatus('pending');
  }, [supabase]);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      else setStatus('signed-out');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setSupaPlayer(null);
        setPendingRequest(null);
        setStatus('signed-out');
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadProfile]);

  const value: AuthState = {
    status,
    session,
    authUser: session?.user ?? null,
    supaPlayer,
    pendingRequest,

    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error ? translateAuthError(error.message) : null };
    },

    signOut: async () => {
      await supabase.auth.signOut();
    },

    register: async ({ email, password, name, callsign, nickname, phone, photoFile }) => {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });
      if (signUpError) return { error: translateAuthError(signUpError.message) };

      const userId = signUpData.user?.id;
      if (!userId) {
        return {
          error:
            'Revisa tu correo para confirmar la cuenta antes de continuar (o pide a comandancia que desactive la confirmación por correo).',
        };
      }

      let photoUrl: string | undefined;
      if (photoFile) {
        const path = `${userId}/${Date.now()}-${photoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('player-photos')
          .upload(path, photoFile, { upsert: true });
        if (!uploadError) {
          const { data: pub } = supabase.storage.from('player-photos').getPublicUrl(path);
          photoUrl = pub.publicUrl;
        }
      }

      const cleanCallsign = callsign.trim().toUpperCase();
      const { data: matched } = await supabase
        .from('players')
        .select('id')
        .ilike('callsign', cleanCallsign)
        .is('user_id', null)
        .maybeSingle();

      const { error: reqError } = await supabase.from('registration_requests').insert({
        user_id: userId,
        matched_player_id: matched?.id ?? null,
        name: name.trim(),
        callsign: cleanCallsign,
        nickname: nickname?.trim() || null,
        phone: phone.trim(),
        photo_url: photoUrl ?? null,
      });
      if (reqError) {
        return { error: 'La cuenta se creó pero la solicitud no se pudo enviar: ' + reqError.message };
      }

      await loadProfile(userId);
      return { error: null };
    },

    requestPasswordReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error: error ? translateAuthError(error.message) : null };
    },

    refreshPlayer: async () => {
      if (session) await loadProfile(session.user.id);
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
