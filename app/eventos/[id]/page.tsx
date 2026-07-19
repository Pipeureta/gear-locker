'use client';

import { use, useRef, useState } from 'react';
import ModalShell from '@/components/ModalShell';
import Link from 'next/link';
import { daysUntil, fmtDate, rolesForPlayer, type RsvpStatus } from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';
import { fileToDataUrl, fmtBytes } from '@/lib/img';

const RSVP_LABEL: Record<RsvpStatus, string> = {
  va: '✓ Voy',
  'tal-vez': '? Tal vez',
  'no-va': '✗ No voy',
};

const FILE_ICO: Record<string, string> = { mapa: '▦', documento: '▤', imagen: '▣' };

export default function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const player = useCurrentPlayer();
  const { rsvps, setRsvp, adminView, playerById, eventUploads, addEventUpload, removeEventUpload, events } = useStore();
  const event = events.find((item) => item.id === id);

  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [upMsg, setUpMsg] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [editingResponse, setEditingResponse] = useState(false);

  if (!event) {
    return (
      <div className="lat-alert crit">
        Evento no encontrado. <Link href="/eventos" className="acc">Volver a eventos</Link>
      </div>
    );
  }

  const myRsvp = rsvps[event.id]?.[player.id];
  const eventRsvps = rsvps[event.id] ?? {};
  const going = Object.entries(eventRsvps).filter(([, s]) => s === 'va').map(([pid]) => pid);
  const maybe = Object.entries(eventRsvps).filter(([, s]) => s === 'tal-vez').map(([pid]) => pid);
  const notGoing = Object.entries(eventRsvps).filter(([, s]) => s === 'no-va').map(([pid]) => pid);
  const isPast = daysUntil(event.date) < 0;

  const uploads = eventUploads.filter((f) => f.eventId === event.id);
  const photos = uploads.filter((f) => f.kind === 'imagen');
  const docs = uploads.filter((f) => f.kind !== 'imagen');

  const squads = [...new Set(event.assignments.map((a) => a.squad))];
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(event.mapsQuery)}`;

  const upload = async (f: File | undefined, forcePhoto: boolean) => {
    if (!f) return;
    try {
      const isImage = f.type.startsWith('image/');
      const dataUrl = await fileToDataUrl(f, forcePhoto ? 1600 : 1200);
      addEventUpload({
        eventId: event.id,
        name: f.name,
        kind: isImage ? 'imagen' : f.name.toLowerCase().includes('mapa') ? 'mapa' : 'documento',
        dataUrl,
        size: fmtBytes(f.size),
      });
      setUpMsg(null);
    } catch (err) {
      setUpMsg(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    }
  };

  return (
    <>
      {/* Cabecera */}
      <div className="lat-panel">
        <div className="row between">
          <div className="row">
            <div className="event-date-block">
              <span className="d">{parseInt(event.date.slice(8), 10)}</span>
              <span className="m">{fmtDate(event.date).split(' ')[2]}</span>
            </div>
            <div>
              <div className="rc-name" style={{ fontSize: 15 }}>{event.name}</div>
              <div className="rc-sub">
                {fmtDate(event.date)} · {event.startTime} HRS
                {!isPast && <span className="acc"> · faltan {daysUntil(event.date)} días</span>}
              </div>
            </div>
          </div>
          <span className={`lat-chip ${event.type === 'MILSIM' ? 'warn' : event.type === 'Entrenamiento' ? 'dim' : ''}`}>
            {event.type}
          </span>
        </div>
        <p className="help" style={{ margin: 0 }}>{event.description}</p>
        {!isPast && (
          <span className="help acc">¿Vas a este evento? Marca tu respuesta aquí — así comandancia puede armar los squads:</span>
        )}
        <div className="row">
          {!isPast && myRsvp && !editingResponse ? (
            <div className="rsvp-current">
              <span className={`lat-chip ${myRsvp === 'va' ? 'ok' : myRsvp === 'no-va' ? 'crit' : 'warn'}`}>{RSVP_LABEL[myRsvp]}</span>
              <button className="lat-btn ghost sm" type="button" onClick={() => setEditingResponse(true)}>✎ Editar respuesta</button>
            </div>
          ) : !isPast ? (
            (['va', 'tal-vez', 'no-va'] as RsvpStatus[]).map((status) => (
              <button
                key={status}
                className={`lat-btn ${status === 'va' ? 'ok-line' : status === 'no-va' ? 'danger' : 'warn-line'}`}
                onClick={() => { setRsvp(event.id, player.id, status); setEditingResponse(false); }}
              >
                {RSVP_LABEL[status]}
              </button>
            ))
          ) : null}
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="lat-btn">
            ⌖ Cómo llegar (Google Maps)
          </a>
          {event.externalLink && (
            <a href={event.externalLink} target="_blank" rel="noreferrer" className="lat-btn ghost">
              ↗ Página del evento
            </a>
          )}
        </div>
      </div>

      <div className="grid briefing-grid" style={{ marginTop: 14 }}>
        {/* Info operacional */}
        <div className="lat-panel">
          <div className="panel-head"><h3>Datos de la operación</h3></div>
          <div className="kv"><span className="k">Ubicación</span><span className="v">{event.location}</span></div>
          <div className="kv"><span className="k">Inicio</span><span className="v">{event.startTime} HRS</span></div>
          <div className="kv"><span className="k">Confirmados</span><span className="v ok">{going.length}</span></div>
          <div className="kv"><span className="k">Tal vez</span><span className="v warn">{maybe.length}</span></div>
          <div className="kv"><span className="k">No van</span><span className="v crit">{notGoing.length}</span></div>
          {event.fpsLimits.length > 0 && (
            <>
              <div className="tiny dim-t" style={{ marginTop: 8 }}>Límites FPS (bola 0.20g)</div>
              {event.fpsLimits.map((l) => (
                <div className="kv" key={l.role}>
                  <span className="k">{l.role}</span>
                  <span className="v warn">{l.max} FPS</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Recordatorios */}
        <div className="lat-panel">
          <div className="panel-head"><h3>Recordatorios</h3></div>
          {event.reminders.length === 0 && <div className="empty-state">Sin recordatorios para este evento.</div>}
          {event.reminders.map((r, i) => (
            <div key={i} className="lat-alert warn" style={{ padding: '7px 10px' }}>{r}</div>
          ))}
        </div>

        {/* Documentos */}
        <div className="lat-panel">
          <div className="panel-head">
            <h3>Mapas y documentos</h3>
            {adminView && (
              <button className="lat-btn ghost sm" onClick={() => fileRef.current?.click()}>+ Subir</button>
            )}
          </div>
          {event.files.length === 0 && docs.length === 0 && (
            <div className="empty-state">Aún no hay documentos. Comandancia los sube antes del evento.</div>
          )}
          {event.files.map((f) => (
            <div key={f.id} className="row between small" style={{ padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
              <span><span className="acc">{FILE_ICO[f.kind]}</span> {f.name} <span className="tiny dim-t">(ejemplo)</span></span>
              <span className="tiny mut">{f.size}</span>
            </div>
          ))}
          {docs.map((f) => (
            <div key={f.id} className="row between small" style={{ padding: '4px 0', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
              <span><span className="acc">{FILE_ICO[f.kind]}</span> {f.name}</span>
              <span className="row" style={{ gap: 4 }}>
                <span className="tiny mut">{f.size}</span>
                <a className="lat-btn ghost sm" href={f.dataUrl} target="_blank" rel="noreferrer">Ver</a>
                <a className="lat-btn ghost sm" href={f.dataUrl} download={f.name}>⇓</a>
                {adminView && (
                  <button className="lat-btn danger sm" onClick={() => removeEventUpload(f.id)}>✗</button>
                )}
              </span>
            </div>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.kml,.gpx"
            style={{ display: 'none' }}
            onChange={(e) => { upload(e.target.files?.[0], false); e.target.value = ''; }}
          />
          {upMsg && <div className="lat-alert warn"><span className="help">{upMsg}</span></div>}
        </div>

        {/* Plan de comunicaciones */}
        <div className="lat-panel">
          <div className="panel-head"><h3>Plan de radio (SOI)</h3></div>
          {event.comms.length === 0 && <div className="empty-state">Sin plan de radio para este evento.</div>}
          {event.comms.length > 0 && (
            <div className="table-scroll radio-plan-desktop">
              <table className="lat-table radio-plan-table">
                <thead>
                  <tr><th>Canal</th><th>Nombre del canal</th><th>Rx (MHz)</th><th>Tx (MHz)</th><th>Rx CTCSS</th><th>Tx CTCSS</th><th>Scan Add</th><th>Busylock</th><th>WN Band</th><th>Power</th><th>Signal Code</th></tr>
                </thead>
                <tbody>
                  {event.comms.map((channel, index) => (
                    <tr key={`${channel.channel}-${index}`}>
                      <td className="badge-ok">{channel.channel}</td>
                      <td>{channel.name ?? channel.squad ?? '—'}</td>
                      <td className="mono-dim">{channel.rxMhz ?? channel.freq ?? '—'}</td>
                      <td className="mono-dim">{channel.txMhz ?? channel.freq ?? '—'}</td>
                      <td className="mono-dim">{channel.rxCtcss ?? 'OFF'}</td>
                      <td className="mono-dim">{channel.txCtcss ?? 'OFF'}</td>
                      <td>{channel.scanAdd ?? 'ON'}</td>
                      <td>{channel.busylock ?? 'OFF'}</td>
                      <td>{channel.wnBand ?? 'Wide'}</td>
                      <td>{channel.power ?? 'High'}</td>
                      <td>{channel.signalCode ?? '1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {event.comms.length > 0 && (
            <div className="radio-plan-mobile">
              <table className="lat-table">
                <thead><tr><th>Canal</th><th>Nombre del canal</th><th>Rx (MHz)</th><th>Tx (MHz)</th></tr></thead>
                <tbody>
                  {event.comms.map((channel, index) => (
                    <tr key={`${channel.channel}-mobile-${index}`}>
                      <td className="badge-ok">{channel.channel}</td>
                      <td>{channel.name ?? channel.squad ?? '—'}</td>
                      <td className="mono-dim">{channel.rxMhz ?? channel.freq ?? '—'}</td>
                      <td className="mono-dim">{channel.txMhz ?? channel.freq ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fotos */}
      <div className="section-title">Fotos del evento</div>
      <div className="lat-panel">
        {adminView && (
          <div className="row between">
            <span className="help">Sube fotos del terreno, del briefing o del evento — todo el equipo puede verlas y descargarlas.</span>
            <button className="lat-btn ghost sm" onClick={() => photoRef.current?.click()}>+ Subir foto</button>
          </div>
        )}
        {photos.length === 0 ? (
          <div className="empty-state">
            Todavía no hay fotos. {adminView ? 'Usa "Subir foto" para agregar la primera.' : 'Comandancia puede subir fotos del terreno o del evento.'}
          </div>
        ) : (
          <div className="gallery">
            {photos.map((f) => (
              <button key={f.id} className="g-item" onClick={() => setLightbox(f.dataUrl)} title={f.name}>
                <img src={f.dataUrl} alt={f.name} />
              </button>
            ))}
          </div>
        )}
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => { upload(e.target.files?.[0], true); e.target.value = ''; }}
        />
      </div>

      {/* ORBAT */}
      {event.assignments.length > 0 && (
        <>
          <div className="section-title">Orden de batalla (ORBAT)</div>
          <div className="grid cols-3">
            {squads.map((squad) => {
              const members = event.assignments.filter((a) => a.squad === squad);
              return (
                <div key={squad} className="squad-block">
                  <div className="squad-head">
                    <span>SQ {squad}</span>
                    <span className="mut">{members.length} PAX</span>
                  </div>
                  {members.map((a) => {
                    const p = playerById(a.playerId);
                    if (!p) return null;
                    return (
                      <div key={a.playerId} className="squad-row">
                        <span className="avatar sm">
                          {p.photoUrl ? <img src={p.photoUrl} alt={p.callsign} /> : p.callsign}
                        </span>
                        <span className={a.playerId === player.id ? 'acc' : ''}>{p.name.toUpperCase()}</span>
                        <span className="squad-role">{a.role}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Roster de confirmados */}
      <div className="section-title">Quiénes van</div>
      <div className="grid cols-3">
        <div className="lat-panel">
          <div className="panel-head"><h3>Confirmados ({going.length})</h3></div>
          {going.map((pid) => {
            const p = playerById(pid);
            const assigned = event.assignments.find((a) => a.playerId === pid);
            return p ? (
              <div key={pid} className="row between small">
                <span><span className="dot-i ok" />{p.callsign} {p.name.toUpperCase()}</span>
                <span className="tiny mut">{assigned ? `${assigned.squad} / ${assigned.role}` : rolesForPlayer(p).join(' · ')}</span>
              </div>
            ) : null;
          })}
          {going.length === 0 && <div className="empty-state">Nadie ha confirmado todavía.</div>}
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>Tal vez ({maybe.length})</h3></div>
          {maybe.map((pid) => {
            const p = playerById(pid);
            return p ? (
              <div key={pid} className="small"><span className="dot-i warn" />{p.callsign} {p.name.toUpperCase()}</div>
            ) : null;
          })}
          {maybe.length === 0 && <span className="small mut">—</span>}
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>No van ({notGoing.length})</h3></div>
          {notGoing.map((pid) => {
            const p = playerById(pid);
            return p ? (
              <div key={pid} className="small"><span className="dot-i crit" />{p.callsign} {p.name.toUpperCase()}</div>
            ) : null;
          })}
          {notGoing.length === 0 && <span className="small mut">—</span>}
        </div>
      </div>

      {lightbox && (
        <ModalShell onClose={() => setLightbox(null)} style={{ maxWidth: 820 }}>
            <img src={lightbox} alt="Foto del evento" style={{ maxWidth: '100%', border: '1px solid var(--border)' }} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <a className="lat-btn" href={lightbox} download="foto-evento.jpg">⇓ Descargar</a>
              <button className="lat-btn ghost" onClick={() => setLightbox(null)}>Cerrar</button>
            </div>
        </ModalShell>
      )}
    </>
  );
}
