'use client';

// Editor de asistencia real de un evento — Comandancia marca quién estuvo,
// independiente del RSVP (alguien pudo confirmar y no llegar, o llegar sin
// haber confirmado).

import { useEffect } from 'react';
import ModalShell from '@/components/ModalShell';
import { useStore } from '@/lib/store';
import { sortByCallsign } from '@/lib/data';

export default function AttendanceEditor({
  eventId,
  onClose,
}: {
  eventId: string;
  onClose: () => void;
}) {
  const { players, events, setEventAttended } = useStore();
  const event = events.find((e) => e.id === eventId);

  // El evento pudo haberse eliminado mientras el modal estaba abierto.
  useEffect(() => {
    if (!event) onClose();
  }, [event, onClose]);

  if (!event) return null;

  const attended = new Set(event.attended ?? []);
  const sorted = sortByCallsign(players);

  return (
    <ModalShell onClose={onClose}>
      <h2>Asistencia — {event.name}</h2>
      <span className="help">
        Marca quién estuvo realmente en este evento. Es independiente de la respuesta RSVP de cada uno.
      </span>
      <div className="gear-grid">
        {sorted.map((p) => (
          <label key={p.id} className={`gear-check${attended.has(p.id) ? ' on' : ''}`}>
            <input
              type="checkbox"
              checked={attended.has(p.id)}
              onChange={(e) => setEventAttended(event.id, p.id, e.target.checked)}
            />
            <span>{p.callsign} {p.name.toUpperCase()}</span>
          </label>
        ))}
        {sorted.length === 0 && <div className="empty-state">No hay integrantes registrados.</div>}
      </div>
      <span className="tiny mut">{attended.size}/{players.length} marcados como asistentes.</span>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="lat-btn primary" onClick={onClose}>Listo</button>
      </div>
    </ModalShell>
  );
}
