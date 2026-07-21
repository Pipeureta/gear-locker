'use client';

import Link from 'next/link';
import { daysUntil, fmtDate, monthOf, upcomingEvents } from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';
import DeploymentCountdown from '@/components/DeploymentCountdown';
import RsvpPrompt from '@/components/RsvpPrompt';

export default function HQPage() {
  const player = useCurrentPlayer();
  const { rsvps, dues, announcements, events: publishedEvents } = useStore();
  const events = upcomingEvents(new Date(), publishedEvents);
  const next = events[0];
  const pending = dues.filter((d) => d.playerId === player.id && !d.paid);

  const nextAssignment = next?.assignments.find((a) => a.playerId === player.id);

  // Eventos publicados que aún no respondo → pedir confirmación.
  const unanswered = events.filter((e) => !rsvps[e.id]?.[player.id]);
  // Próximo evento que confirmé → cuenta regresiva de despliegue.
  const nextConfirmed = events.find((e) => rsvps[e.id]?.[player.id] === 'va');

  return (
    <>
      <p className="page-intro">
        Hola {player.name}. Este es el resumen del equipo: tu estado, los avisos de comandancia y lo que viene.
      </p>

      <div className="quick-actions" aria-label="Accesos rápidos">
        <Link href="/eventos" className="quick-action">
          <span className="quick-action-icon">◉</span>
          <span><strong>Eventos</strong><small>Confirma asistencia y revisa briefings</small></span>
          <span className="quick-action-arrow">→</span>
        </Link>
        <Link href="/cuotas" className="quick-action">
          <span className="quick-action-icon">◇</span>
          <span><strong>Mis cuotas</strong><small>Revisa pagos y sube comprobantes</small></span>
          <span className="quick-action-arrow">→</span>
        </Link>
        <Link href="/roster" className="quick-action">
          <span className="quick-action-icon">▦</span>
          <span><strong>Equipo</strong><small>Consulta integrantes y perfiles</small></span>
          <span className="quick-action-arrow">→</span>
        </Link>
        {player.isAdmin && (
          <Link href="/comandancia" className="quick-action admin">
            <span className="quick-action-icon">✦</span>
            <span><strong>Comandancia</strong><small>Gestiona equipo, finanzas e inventario</small></span>
            <span className="quick-action-arrow">→</span>
          </Link>
        )}
      </div>

      <RsvpPrompt events={unanswered} />

      {nextConfirmed && (
        <div style={{ marginBottom: 14 }}>
          <DeploymentCountdown event={nextConfirmed} />
        </div>
      )}

      <div className="grid cols-2">
        <div className="lat-panel">
          <div className="panel-head"><h3>Mi cuota</h3></div>
          {pending.length === 0 ? (
            <>
              <div className="big-num ok">AL DÍA</div>
              <span className="help">No tienes meses pendientes. ✔</span>
            </>
          ) : (
            <>
              <div className="big-num crit">
                {pending.length}<span className="unit">{pending.length === 1 ? 'mes' : 'meses'}</span>
              </div>
              <span className="help">Tienes cuotas pendientes por pagar.</span>
              <Link href="/cuotas" className="lat-btn danger sm">Ver cómo pagar</Link>
            </>
          )}
        </div>


        <div className="lat-panel">
          <div className="panel-head"><h3>Mi próximo rol</h3></div>
          {nextAssignment ? (
            <>
              <div className="big-num warn" style={{ fontSize: 22 }}>{nextAssignment.role.toUpperCase()}</div>
              <span className="help">
                Squad {nextAssignment.squad} en {next?.name}.
              </span>
            </>
          ) : (
            <>
              <div className="big-num" style={{ fontSize: 22 }}>SIN ASIGNAR</div>
              <span className="help">Comandancia asigna los roles antes de cada evento.</span>
            </>
          )}
        </div>
      </div>

      <div className="section-title">Avisos de comandancia</div>
      <div className="grid" style={{ gap: 8 }}>
        {announcements.length === 0 && (
          <div className="empty-state">No hay avisos por ahora. Aquí aparecerán las novedades del equipo.</div>
        )}
        {announcements.map((a) => (
          <div key={a.id} className={`lat-alert ${a.severity === 'info' ? '' : a.severity}`}>
            <div className="alert-title">Comandancia — {fmtDate(a.date)}</div>
            <strong style={{ display: 'block', marginBottom: 2 }}>{a.title}</strong>
            <span className="help">{a.body}</span>
          </div>
        ))}
      </div>

      <div className="section-title">Próximos eventos</div>
      <div className="grid cols-3">
        {events.map((e) => {
          const myRsvp = rsvps[e.id]?.[player.id];
          const confirmed = Object.values(rsvps[e.id] ?? {}).filter((s) => s === 'va').length;
          const dleft = daysUntil(e.date);
          return (
            <Link key={e.id} href={`/eventos/${e.id}`} className="lat-panel event-card">
              <div className="row between">
                <div className="event-date-block">
                  <span className="d">{parseInt(e.date.slice(8), 10)}</span>
                  <span className="m">{monthOf(e.date)}</span>
                </div>
                <span className={`lat-chip ${e.type === 'MILSIM' ? 'warn' : e.type === 'Entrenamiento' ? 'dim' : ''}`}>
                  {e.type}
                </span>
              </div>
              <div>
                <div className="rc-name">{e.name}</div>
                <div className="rc-sub">{e.location}</div>
              </div>
              <div className="kv"><span className="k">Fecha</span><span className="v">{fmtDate(e.date)} · {e.startTime}</span></div>
              <div className="kv"><span className="k">Faltan</span><span className="v accent">{dleft} días</span></div>
              <div className="kv"><span className="k">Confirmados</span><span className="v ok">{confirmed}</span></div>
              <div className="kv">
                <span className="k">Mi estado</span>
                <span className={`v ${myRsvp === 'va' ? 'ok' : myRsvp === 'no-va' ? 'crit' : myRsvp === 'tal-vez' ? 'warn' : ''}`}>
                  {myRsvp === 'va' ? 'CONFIRMADO' : myRsvp === 'no-va' ? 'NO VOY' : myRsvp === 'tal-vez' ? 'TAL VEZ' : 'SIN RESPUESTA'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>


    </>
  );
}
