'use client';

// Página de destino del correo de recuperación de Supabase
// (auth.resetPasswordForEmail). El enlace deja una sesión temporal activa;
// aquí solo se pide la contraseña nueva.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setMsg('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMsg(
        /session|token/i.test(error.message)
          ? 'El enlace ya expiró. Vuelve a pedir uno nuevo desde la pantalla de ingreso.'
          : error.message,
      );
      return;
    }
    setDone(true);
  };

  return (
    <div className="lat-grid-bg">
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-brand">
            <img src="/logo.svg" alt="Team Six Devgru" className="login-logo" />
            <div className="lb-title">Gear Locker</div>
            <div className="lb-sub">Nueva contraseña</div>
          </div>

          {done ? (
            <div className="form-stack">
              <div className="lat-alert ok">
                <div className="alert-title">Contraseña actualizada</div>
                <span className="help">Ya puedes entrar con tu nueva contraseña.</span>
              </div>
              <button className="lat-btn primary" onClick={() => router.push('/')}>Ir a la app</button>
            </div>
          ) : (
            <form onSubmit={submit} className="form-stack">
              <div className="lat-field">
                <label>Nueva contraseña</label>
                <input
                  className="lat-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                />
              </div>
              <div className="lat-field">
                <label>Repetir contraseña</label>
                <input
                  className="lat-input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite tu contraseña"
                />
              </div>
              {msg && <div className="lat-alert warn">{msg}</div>}
              <button className="lat-btn primary" type="submit" disabled={busy}>
                {busy ? 'Guardando...' : 'Guardar nueva contraseña'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
