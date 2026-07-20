'use client';

import type { PendingRegistration } from '@/lib/auth-context';

export default function PendingApprovalScreen({
  request,
  onSignOut,
}: {
  request: PendingRegistration | null;
  onSignOut: () => void;
}) {
  return (
    <div className="lat-grid-bg">
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-brand">
            <img src="/logo.svg" alt="Team Six Devgru" className="login-logo" />
            <div className="lb-title">Gear Locker</div>
            <div className="lb-sub">Team Six Devgru</div>
          </div>

          <div className="lat-alert warn">
            <div className="alert-title">Esperando aprobación</div>
            <span className="help">
              {request
                ? `Tu solicitud como ${request.callsign} — ${request.name} está esperando que comandancia la revise.`
                : 'Tu cuenta está creada pero todavía no tiene una solicitud asociada. Contacta a comandancia.'}
              {' '}
              {request?.matched_player_id
                ? 'Al aprobarla, tomarás el lugar de una ficha ya existente en el equipo.'
                : ''}
            </span>
          </div>
          <span className="tiny mut">Vuelve a entrar más tarde, o pide a comandancia que la apruebe desde Comandancia → Equipo.</span>
          <button className="lat-btn ghost" onClick={onSignOut}>⏻ Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}
