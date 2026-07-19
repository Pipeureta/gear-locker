'use client';

import Link from 'next/link';
import { useState } from 'react';
import { fmtDate, pastEvents, upcomingEvents } from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';
import type { RsvpStatus } from '@/lib/data';

const RSVP_LABEL: Record<RsvpStatus, string> = {
  va: '✓ Voy',
  'tal-vez': '? Tal vez',
  'no-va': '✗ No voy',
};

export default function EventosPage() {
  const player = useCurrentPlayer();
  const { rsvps, setRsvp, events } = useStore();
  const [editingRsvpId, setEditingRsvpId] = useState<string | null>(null);
  const upcoming = upcomingEvents(new Date(), events);
  const past = pastEvents(new Date(), events);

  return (
    <>
      <p className="page-intro">
        Marca si vas a cada evento — con un toque en &quot;✓ Voy&quot; quedas confirmado. Entra al Briefing Room para ver mapas, plan de radio y tu squad.
      </p>
      <div className="section-title">Próximos</div>
      <div className="grid" style={{ gap: 12 }}>
        {upcoming.map((e) => {
          const myRsvp = rsvps[e.id]?.[player.id];
          const confirmed = Object.values(rsvps[e.id] ?? {}).filter((s) => s === 'va').length;
          return (
            <div key={e.id} className="lat-panel">
              <div className="row between">
                <div className="row">
                  <div className="event-date-block">
                    <span className="d">{parseInt(e.date.slice(8), 10)}</span>
                    <span className="m">{fmtDate(e.date).split(' ')[2]}</span>
                  </div>
                  <div>
                    <div className="rc-name">{e.name}</div>
                    <div className="rc-sub">
                      {fmtDate(e.date)} · {e.startTime} · {e.location}
                    </div>
                  </div>
                </div>
                <span className={`lat-chip ${e.type === 'MILSIM' ? 'warn' : e.type === 'Entrenamiento' ? 'dim' : ''}`}>
                  {e.type}
                </span>
              </div>

              <p className="small mut" style={{ margin: '4px 0' }}>{e.description}</p>

              <div className="row between">
                <div className="row">
                  {myRsvp && editingRsvpId !== e.id ? (
                    <div className="rsvp-current">
                      <span className={`lat-chip ${myRsvp === 'va' ? 'ok' : myRsvp === 'no-va' ? 'crit' : 'warn'}`}>{RSVP_LABEL[myRsvp]}</span>
                      <button className="lat-btn ghost sm" type="button" onClick={() => setEditingRsvpId(e.id)} aria-label={`Editar respuesta para ${e.name}`}>✎ Editar</button>
                    </div>
                  ) : (
                    (['va', 'tal-vez', 'no-va'] as RsvpStatus[]).map((status) => (
                      <button
                        key={status}
                        className={`lat-btn sm ${status === 'va' ? 'ok-line' : status === 'no-va' ? 'danger' : 'warn-line'}`}
                        onClick={() => { setRsvp(e.id, player.id, status); setEditingRsvpId(null); }}
                      >
                        {RSVP_LABEL[status]}
                      </button>
                    ))
                  )}
                  <span className="tiny mut" style={{ marginLeft: 6 }}>
                    {confirmed} confirmados
                  </span>
                </div>
                <div className="row">
                  {e.externalLink && (
                    <a href={e.externalLink} target="_blank" rel="noreferrer" className="lat-btn ghost sm">
                      ↗ Evento
                    </a>
                  )}
                  <Link href={`/eventos/${e.id}`} className="lat-btn sm">
                    ◎ Briefing Room
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="section-title">Historial</div>
      <div className="lat-panel">
        <div className="table-scroll">
          <table className="lat-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Evento</th>
                <th>Tipo</th>
                <th>Lugar</th>
                <th>Asistentes</th>
                <th>Yo</th>
              </tr>
            </thead>
            <tbody>
              {past.map((e) => (
                <tr key={e.id}>
                  <td className="mono-dim">{fmtDate(e.date)}</td>
                  <td>{e.name}</td>
                  <td className="mono-dim">{e.type}</td>
                  <td className="mono-dim">{e.location}</td>
                  <td>{e.attended?.length ?? 0}</td>
                  <td className={e.attended?.includes(player.id) ? 'badge-ok' : 'badge-crit'}>
                    {e.attended?.includes(player.id) ? 'ASISTÍ' : 'AUSENTE'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
