'use client';

import { useState } from 'react';
import ModalShell from '@/components/ModalShell';
import { DEFAULT_RADIO_CHANNELS, fmtDate, ROLES, sortByCallsign, type CommsChannel, type GameEvent, type Role } from '@/lib/data';
import { useStore } from '@/lib/store';
import { useGearChecklist } from '@/lib/gear-checklist';

type EventDraft = Omit<GameEvent, 'id'>;
type EventType = GameEvent['type'];

const cloneDefaults = () => DEFAULT_RADIO_CHANNELS.map((channel) => ({ ...channel }));

function editableComms(initial?: GameEvent): CommsChannel[] {
  if (!initial?.comms.length) return cloneDefaults();
  return initial.comms.map((channel) => ({
    channel: channel.channel,
    name: channel.name ?? channel.squad ?? '',
    rxMhz: channel.rxMhz ?? channel.freq?.replace(/ MHz$/i, '') ?? '',
    txMhz: channel.txMhz ?? channel.freq?.replace(/ MHz$/i, '') ?? '',
    rxCtcss: channel.rxCtcss ?? 'OFF',
    txCtcss: channel.txCtcss ?? 'OFF',
    scanAdd: channel.scanAdd ?? 'ON',
    busylock: channel.busylock ?? 'OFF',
    wnBand: channel.wnBand ?? 'Wide',
    power: channel.power ?? 'High',
    signalCode: channel.signalCode ?? '1',
    notes: channel.notes,
  }));
}

export default function EventEditor({
  initial,
  onSave,
  onClose,
}: {
  initial?: GameEvent;
  onSave: (event: EventDraft) => void;
  onClose: () => void;
}) {
  const { players } = useStore();
  const { items: gearChecklist } = useGearChecklist();
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState<EventType>(initial?.type ?? 'Combat Mission');
  const [date, setDate] = useState(initial?.date ?? '');
  const [startTime, setStartTime] = useState(initial?.startTime ?? '09:00');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [mapsQuery, setMapsQuery] = useState(initial?.mapsQuery ?? '');
  const [externalLink, setExternalLink] = useState(initial?.externalLink ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [reminders, setReminders] = useState((initial?.reminders ?? []).join('\n'));
  const [fpsLimits, setFpsLimits] = useState(initial?.fpsLimits ?? [{ role: 'Fusil / SMG', max: 350 }]);
  const [comms, setComms] = useState<CommsChannel[]>(editableComms(initial));
  const [assignments, setAssignments] = useState(initial?.assignments ?? []);
  const [requiredGear, setRequiredGear] = useState<string[]>(initial?.requiredGear ?? []);
  const [teamNames, setTeamNames] = useState<string[]>(() => {
    const existing = [...new Set((initial?.assignments ?? []).map((assignment) => assignment.squad))];
    return existing.length ? existing : ['Equipo 1'];
  });
  const [message, setMessage] = useState<string | null>(null);

  const updateComms = (index: number, field: keyof CommsChannel, value: string) => {
    setComms((current) => current.map((channel, position) => position === index ? { ...channel, [field]: value } : channel));
  };

  const save = () => {
    if (!name.trim() || !date || !startTime || !location.trim() || !description.trim()) {
      setMessage('Completa nombre, fecha, hora, lugar y descripción antes de publicar.');
      return;
    }
    if (comms.some((channel) => !channel.channel.trim() || !channel.name?.trim())) {
      setMessage('Cada señal de radio debe tener canal y nombre.');
      return;
    }
    onSave({
      name: name.trim(),
      type,
      date,
      startTime,
      location: location.trim(),
      mapsQuery: mapsQuery.trim() || location.trim(),
      externalLink: externalLink.trim() || undefined,
      description: description.trim(),
      fpsLimits: fpsLimits.filter((limit) => limit.role.trim() && limit.max > 0),
      reminders: reminders.split('\n').map((item) => item.trim()).filter(Boolean),
      files: initial?.files ?? [],
      comms: comms.map((channel) => ({ ...channel, channel: channel.channel.trim(), name: channel.name?.trim() })),
      assignments,
      attended: initial?.attended,
      requiredGear,
    });
  };

  return (
    <ModalShell onClose={onClose} className="event-editor-modal">
        <div className="row between event-editor-heading">
          <div>
            <h2>{initial ? `Editar evento — ${initial.name}` : 'Publicar evento'}</h2>
            <span className="help">Al guardar aparecerá inmediatamente en HQ, Eventos y confirmaciones de asistencia.</span>
          </div>
          <button className="lat-btn ghost" type="button" onClick={onClose}>Cerrar</button>
        </div>

        <div className="event-editor-section">
          <div className="panel-head"><h3>Información general</h3></div>
          <div className="grid cols-2 compact-grid">
            <div className="lat-field"><label>Nombre del evento</label><input className="lat-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej: Operación Nómada" /></div>
            <div className="lat-field"><label>Tipo</label><select className="lat-select" value={type} onChange={(event) => setType(event.target.value as EventType)}><option>MILSIM</option><option>Combat Mission</option><option>Partida Abierta</option><option>Partida Cerrada</option><option>Entrenamiento</option></select></div>
            {/* lang="es-CL" fuerza el orden dd-mm-aaaa en el selector nativo:
                sin esto el navegador usa su propio idioma y podía mostrar
                mm/dd/aaaa, que se presta para escribir la fecha al revés. */}
            <div className="lat-field">
              <label>Fecha</label>
              <input className="lat-input" type="date" lang="es-CL" value={date} onChange={(event) => setDate(event.target.value)} />
              {/* El selector nativo se ve distinto según el navegador (algunos
                  muestran mm/dd/aaaa), así que se confirma abajo la fecha
                  elegida en texto para que no quede duda. */}
              {date && <span className="tiny acc">{fmtDate(date)}</span>}
            </div>
            <div className="lat-field"><label>Hora de inicio</label><input className="lat-input" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div>
            <div className="lat-field"><label>Lugar</label><input className="lat-input" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Cancha o recinto" /></div>
            <div className="lat-field"><label>Búsqueda para Google Maps</label><input className="lat-input" value={mapsQuery} onChange={(event) => setMapsQuery(event.target.value)} placeholder="Dirección o coordenadas" /></div>
          </div>
          <div className="lat-field"><label>Enlace externo (opcional)</label><input className="lat-input" type="url" value={externalLink} onChange={(event) => setExternalLink(event.target.value)} placeholder="https://..." /></div>
          <div className="lat-field"><label>Descripción / briefing</label><textarea className="lat-textarea" rows={4} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
          <div className="lat-field"><label>Recordatorios (uno por línea)</label><textarea className="lat-textarea" rows={4} value={reminders} onChange={(event) => setReminders(event.target.value)} placeholder={'Llevar baterías cargadas\nProtección ocular obligatoria'} /></div>
        </div>

        <div className="event-editor-section">
          <div className="panel-head"><h3>Límites FPS</h3><button className="lat-btn ghost sm" type="button" onClick={() => setFpsLimits((current) => [...current, { role: '', max: 350 }])}>+ Agregar límite</button></div>
          <div className="fps-editor-list">
            {fpsLimits.map((limit, index) => (
              <div className="fps-editor-row" key={index}>
                <input className="lat-input" value={limit.role} onChange={(event) => setFpsLimits((current) => current.map((item, position) => position === index ? { ...item, role: event.target.value } : item))} placeholder="Rol o réplica" />
                <input className="lat-input" type="number" min="1" value={limit.max} onChange={(event) => setFpsLimits((current) => current.map((item, position) => position === index ? { ...item, max: Number(event.target.value) } : item))} />
                <button className="lat-btn danger sm" type="button" onClick={() => setFpsLimits((current) => current.filter((_, position) => position !== index))}>Quitar</button>
              </div>
            ))}
          </div>
        </div>

        <div className="event-editor-section">
          <div className="panel-head radio-editor-head">
            <div><h3>Orden de batalla (ORBAT)</h3><span className="tiny dim-t">El evento comienza con Equipo 1. Puedes cambiar su nombre, agregar equipos y asignar roles.</span></div>
            <button className="lat-btn ghost sm" type="button" onClick={() => setTeamNames((current) => [...current, `Equipo ${current.length + 1}`])}>+ Agregar equipo</button>
          </div>
          <div className="orbat-team-names">
            {teamNames.map((team, index) => (
              <div className="lat-field" key={index}>
                <label>Nombre equipo {index + 1}</label>
                <div className="row">
                  <input className="lat-input" value={team} onChange={(event) => {
                    const previous = team;
                    const next = event.target.value;
                    setTeamNames((current) => current.map((name, position) => position === index ? next : name));
                    setAssignments((current) => current.map((assignment) => assignment.squad === previous ? { ...assignment, squad: next } : assignment));
                  }} />
                  {teamNames.length > 1 && <button className="lat-btn danger sm" type="button" onClick={() => {
                    const fallback = teamNames.find((_, position) => position !== index) ?? 'Equipo 1';
                    setAssignments((current) => current.map((assignment) => assignment.squad === team ? { ...assignment, squad: fallback } : assignment));
                    setTeamNames((current) => current.filter((_, position) => position !== index));
                  }}>Quitar</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="orbat-editor-list">
            {sortByCallsign(players.filter((player) => player.status === 'activo')).map((player) => {
              const assignment = assignments.find((item) => item.playerId === player.id);
              return (
                <div className={`orbat-editor-row ${assignment ? 'selected' : ''}`} key={player.id}>
                  <label className="orbat-member-toggle">
                    <input type="checkbox" checked={Boolean(assignment)} onChange={(event) => {
                      if (event.target.checked) setAssignments((current) => [...current, { playerId: player.id, squad: teamNames[0] || 'Equipo 1', role: 'Rifleman' }]);
                      else setAssignments((current) => current.filter((item) => item.playerId !== player.id));
                    }} />
                    <span><strong>{player.callsign}</strong> {player.nickname || player.name}</span>
                  </label>
                  <select className="lat-select" value={assignment?.squad ?? teamNames[0]} disabled={!assignment} onChange={(event) => setAssignments((current) => current.map((item) => item.playerId === player.id ? { ...item, squad: event.target.value } : item))}>
                    {teamNames.map((team) => <option key={team} value={team}>{team || 'Sin nombre'}</option>)}
                  </select>
                  <select className="lat-select" value={assignment?.role ?? 'Rifleman'} disabled={!assignment} onChange={(event) => setAssignments((current) => current.map((item) => item.playerId === player.id ? { ...item, role: event.target.value as Role } : item))}>
                    {ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>

        <div className="event-editor-section">
          <div className="panel-head">
            <div><h3>Equipo requerido para este evento</h3><span className="tiny dim-t">Marca qué deben llevar. Cada integrante verá esta lista aparte en el briefing y marcará si lo tiene, independiente de su equipo personal del perfil.</span></div>
          </div>
          {gearChecklist.length === 0 ? (
            <div className="empty-state">No hay ítems en la checklist de equipo (Comandancia → Equipo → Checklist de equipo personal).</div>
          ) : (
            <div className="gear-grid">
              {gearChecklist.map((item) => (
                <label key={item} className={`gear-check${requiredGear.includes(item) ? ' on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={requiredGear.includes(item)}
                    onChange={(e) =>
                      setRequiredGear((current) =>
                        e.target.checked ? [...current, item] : current.filter((i) => i !== item),
                      )
                    }
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="event-editor-section">
          <div className="panel-head radio-editor-head">
            <div><h3>Señales de radio del evento</h3><span className="tiny dim-t">Todos los campos son editables. CH13 debe ajustarse según corresponda.</span></div>
            <div className="row">
              <button className="lat-btn ghost sm" type="button" onClick={() => setComms(cloneDefaults())}>Restaurar 13 canales</button>
              <button className="lat-btn ghost sm" type="button" onClick={() => setComms((current) => [...current, { channel: `CH${current.length + 1}`, name: '', rxMhz: '', txMhz: '', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' }])}>+ Canal</button>
            </div>
          </div>
          <div className="table-scroll radio-editor-scroll">
            <table className="lat-table radio-editor-table">
              <thead><tr><th>Canal</th><th>Nombre del canal</th><th>Rx (MHz)</th><th>Tx (MHz)</th><th>Rx CTCSS</th><th>Tx CTCSS</th><th>Scan Add</th><th>Busylock</th><th>WN Band</th><th>Power</th><th>Signal Code</th><th></th></tr></thead>
              <tbody>
                {comms.map((channel, index) => (
                  <tr key={index}>
                    {(['channel', 'name', 'rxMhz', 'txMhz', 'rxCtcss', 'txCtcss', 'scanAdd', 'busylock', 'wnBand', 'power', 'signalCode'] as (keyof CommsChannel)[]).map((field) => (
                      <td key={field}><input aria-label={`${field} ${index + 1}`} className="lat-input radio-cell-input" value={channel[field] ?? ''} onChange={(event) => updateComms(index, field, event.target.value)} /></td>
                    ))}
                    <td><button className="lat-btn danger sm" type="button" onClick={() => setComms((current) => current.filter((_, position) => position !== index))}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {message && <div className="lat-alert warn"><span className="help">{message}</span></div>}
        <div className="event-editor-actions">
          <button className="lat-btn ghost" type="button" onClick={onClose}>Cancelar</button>
          <button className="lat-btn primary" type="button" onClick={save}>{initial ? 'Guardar cambios' : 'Publicar evento'}</button>
        </div>
    </ModalShell>
  );
}