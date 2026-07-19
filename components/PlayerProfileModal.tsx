'use client';

import { useState } from 'react';
import ModalShell from '@/components/ModalShell';
import { attendancePct, pastEvents, rolesForPlayer, type Player } from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';
import ProfileEditor from '@/components/ProfileEditor';

export default function PlayerProfileModal({
  player,
  onClose,
  onEdit,
}: {
  player: Player;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const currentPlayer = useCurrentPlayer();
  const { adminNotes, setAdminNote, removeAdminNote } = useStore();
  const [editingSelf, setEditingSelf] = useState(false);
  const [noteDraft, setNoteDraft] = useState(adminNotes[player.id] ?? '');
  const [noteSaved, setNoteSaved] = useState(false);
  const isSelf = currentPlayer.id === player.id;
  const canManageNotes = currentPlayer.isAdmin;
  const attendance = attendancePct(player.id);
  const history = pastEvents();
  const attended = history.filter((event) => event.attended?.includes(player.id)).length;

  if (editingSelf) {
    return <ProfileEditor onClose={() => setEditingSelf(false)} />;
  }

  const saveNote = () => {
    const note = noteDraft.trim();
    if (!note) return;
    setAdminNote(player.id, note);
    setNoteSaved(true);
  };

  const deleteNote = () => {
    if (!adminNotes[player.id]) return;
    if (!confirm(`¿Quitar la nota privada de ${player.callsign} ${player.name}?`)) return;
    removeAdminNote(player.id);
    setNoteDraft('');
    setNoteSaved(false);
  };

  return (
    <ModalShell onClose={onClose} className="member-profile-modal">
        <div className="member-profile-hero">
          <span className="avatar member-profile-avatar">
            {player.photoUrl ? <img src={player.photoUrl} alt={player.callsign} /> : player.callsign}
          </span>
          <div className="member-profile-title">
            <div className="row" style={{ gap: 6 }}>
              <span className="lat-chip">{player.callsign}</span>
              {player.isAdmin && <span className="lat-chip warn">COMANDANCIA</span>}
              <span className={`lat-chip ${player.status === 'activo' ? 'ok' : 'dim'}`}>{player.status.toUpperCase()}</span>
            </div>
            <h2>{(player.nickname || player.name).toUpperCase()}</h2>
            <span>{player.nickname ? player.name : 'Nickname aún no registrado'}</span>
          </div>
        </div>

        <div className="member-profile-stats">
          <div>
            <span>Asistencia</span>
            <strong className={attendance >= 70 ? 'okc' : attendance >= 40 ? 'warnc' : 'critc'}>{attendance}%</strong>
            <small>{attended} de {history.length} eventos</small>
          </div>
          <div>
            <span>Rango</span>
            <strong>{player.rank}</strong>
            <small>Desde {player.joinedAt.slice(0, 7)}</small>
          </div>
          <div>
            <span>Roles habituales</span>
            <strong>{rolesForPlayer(player).length}</strong>
            <small>{rolesForPlayer(player).join(' · ')}</small>
          </div>
        </div>

        <div className="member-profile-sections">
          <section className="member-profile-section">
            <div className="panel-head"><h3>Información del integrante</h3></div>
            <div className="kv"><span className="k">Nombre completo</span><span className="v">{player.name}</span></div>
            <div className="kv"><span className="k">Nickname</span><span className="v">{player.nickname || 'Sin registrar'}</span></div>
            <div className="kv"><span className="k">Callsign</span><span className="v acc">{player.callsign}</span></div>
            <div className="kv"><span className="k">Teléfono</span><span className="v">{player.phone || 'Sin registrar'}</span></div>
            <div className="kv"><span className="k">Estado</span><span className={`v ${player.status === 'activo' ? 'ok' : 'warn'}`}>{player.status.toUpperCase()}</span></div>
          </section>

          <section className="member-profile-section">
            <div className="panel-head"><h3>Equipo personal</h3></div>
            {player.loadout ? (
              <>
                <div className="kv"><span className="k">Primaria</span><span className="v">{player.loadout.primary}</span></div>
                <div className="kv"><span className="k">Secundaria</span><span className="v">{player.loadout.secondary || 'Sin registrar'}</span></div>
                <div className="kv"><span className="k">FPS (chrono)</span><span className={`v ${player.loadout.fps <= 350 ? 'ok' : 'warn'}`}>{player.loadout.fps}</span></div>
                <div className="kv"><span className="k">Radio</span><span className="v">{player.loadout.radio || 'Sin registrar'}</span></div>
                <div className="kv"><span className="k">Camo</span><span className="v">{player.loadout.camo || 'Sin registrar'}</span></div>
              </>
            ) : (
              <div className="empty-state">Este integrante todavía no registra su loadout.</div>
            )}
          </section>
        </div>

        {canManageNotes && (
          <section className="admin-note-editor">
            <div className="panel-head">
              <div>
                <h3>Notas de comandancia</h3>
                <span className="tiny dim-t">Privadas: solo las ve y administra Comandancia.</span>
              </div>
              {adminNotes[player.id] && (
                <button className="lat-btn danger sm" type="button" onClick={deleteNote}>Quitar nota</button>
              )}
            </div>
            <textarea
              className="lat-textarea"
              rows={4}
              value={noteDraft}
              onChange={(event) => { setNoteDraft(event.target.value); setNoteSaved(false); }}
              placeholder="Agrega antecedentes, acuerdos o seguimiento interno..."
            />
            <div className="row between">
              <span className="tiny mut">No se muestra en perfiles públicos.</span>
              <button className="lat-btn primary" type="button" disabled={!noteDraft.trim()} onClick={saveNote}>
                {adminNotes[player.id] ? 'Guardar cambios' : 'Agregar nota'}
              </button>
            </div>
            {noteSaved && <div className="lat-alert ok"><span className="help">Nota guardada.</span></div>}
          </section>
        )}

        <div className="member-profile-actions">
          <button className="lat-btn ghost" type="button" onClick={onClose}>Cerrar</button>
          {onEdit && canManageNotes && !isSelf && (
            <button className="lat-btn" type="button" onClick={onEdit}>Editar integrante</button>
          )}
          {isSelf && (
            <button className="lat-btn primary" type="button" onClick={() => setEditingSelf(true)}>Editar mi perfil</button>
          )}
        </div>
    </ModalShell>
  );
}