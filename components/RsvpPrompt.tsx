'use client';

// Aviso de confirmación pendiente: aparece cuando hay eventos publicados que
// el usuario aún no responde. Muestra día de la semana, hora, lugar y cuántos
// días faltan.

import { daysUntil, fmtDate, type GameEvent, type RsvpStatus } from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';

const RSVP_LABEL: Record<RsvpStatus, string> = {
  va: '✓ Voy',
  'tal-vez': '? Tal vez',
  'no-va': '✗ No voy',
};

export default function RsvpPrompt({ events }: { events: GameEvent[] }) {
  const player = useCurrentPlayer();
  const { setRsvp } = useStore();

  if (events.length === 0) return null;

  return (
    <div className="grid" style={{ gap: 10, marginBottom: 14 }}>
      {events.map((e) => {
        const dleft = daysUntil(e.date);
        return (
          <div key={e.id} className="lat-panel" style={{ borderLeft: '3px solid var(--warn)' }}>
            <div className="panel-head">
              <h3 style={{ color: 'var(--warn)' }}>⚠ Confirma tu asistencia</h3>
              <span className="lat-chip warn"><span className="dot" /> Sin responder</span>
            </div>
            <div>
              <div className="rc-name">{e.name}</div>
              <div className="rc-sub">{e.type}</div>
            </div>
            <div className="kv"><span className="k">Día</span><span className="v">{fmtDate(e.date)}</span></div>
            <div className="kv"><span className="k">Hora</span><span className="v">{e.startTime} HRS</span></div>
            <div className="kv"><span className="k">Lugar</span><span className="v">{e.location}</span></div>
            <div className="kv">
              <span className="k">Faltan</span>
              <span className="v accent">{dleft === 0 ? '¡Es hoy!' : dleft === 1 ? '1 día' : `${dleft} días`}</span>
            </div>
            <span className="help">¿Vas? Tu respuesta ayuda a comandancia a armar los squads.</span>
            <div className="row">
              {(['va', 'tal-vez', 'no-va'] as RsvpStatus[]).map((s) => (
                <button
                  key={s}
                  className={`lat-btn ${s === 'va' ? 'ok-line' : s === 'no-va' ? 'danger' : 'warn-line'}`}
                  onClick={() => setRsvp(e.id, player.id, s)}
                >
                  {RSVP_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
