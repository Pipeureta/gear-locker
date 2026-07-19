'use client';

import { useState } from 'react';
import PlayerProfileModal from '@/components/PlayerProfileModal';
import { attendancePct, rolesForPlayer, type Player } from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';

function PlayerCard({ player, onOpen }: { player: Player; onOpen: () => void }) {
  const attendance = attendancePct(player.id);
  const inactive = player.status === 'receso';

  return (
    <div className="lat-panel roster-member-card" style={inactive ? { opacity: 0.65 } : undefined}>
      <button className="roster-card roster-profile-trigger" type="button" onClick={onOpen} aria-label={`Ver perfil de ${player.callsign} ${player.name}`}>
        <span className="avatar lg">
          {player.photoUrl ? <img src={player.photoUrl} alt={player.callsign} /> : player.callsign}
        </span>
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span className="row between">
            <span className="rc-name">{(player.nickname || player.name).toUpperCase()}</span>
            <span className="row" style={{ gap: 4 }}>
              {player.isAdmin && <span className="lat-chip warn" style={{ padding: '2px 6px' }}>CMD</span>}
              {inactive && <span className="lat-chip dim" style={{ padding: '2px 6px' }}>RECESO</span>}
            </span>
          </span>
          <span className="rc-sub">{player.callsign} · {player.name}</span>
          <span className="rc-sub acc">{player.rank} · {rolesForPlayer(player).join(' · ')}</span>
        </span>
        <span className="profile-open-arrow">›</span>
      </button>

      <div className="pbar-row">
        <span className="pbar-label">Asistencia</span>
        <div className={`pbar ${attendance >= 70 ? 'ok' : attendance >= 40 ? 'warn' : 'crit'}`}>
          <span style={{ width: `${attendance}%` }} />
        </div>
        <span className="pbar-val">{attendance}%</span>
      </div>

      <button className="lat-btn ghost sm roster-open-button" type="button" onClick={onOpen}>
        Ver ficha completa
      </button>
    </div>
  );
}

export default function RosterPage() {
  const { adminView, players, playerById } = useStore();
  const currentPlayer = useCurrentPlayer();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? playerById(selectedId) : undefined;
  const active = players.filter((player) => player.status === 'activo');
  const receso = players.filter((player) => player.status === 'receso');

  return (
    <>
      <p className="page-intro">
        Toca la foto, el nombre o el callsign para abrir la ficha completa de cada integrante.
      </p>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="tiny mut">
          {active.length} integrantes activos{receso.length > 0 && ` · ${receso.length} en receso`}
        </span>
        {adminView && currentPlayer.isAdmin && <span className="lat-chip warn"><span className="dot" /> Vista comandancia</span>}
      </div>
      <div className="grid cols-3">
        {[...active, ...receso].map((player) => (
          <PlayerCard key={player.id} player={player} onOpen={() => setSelectedId(player.id)} />
        ))}
      </div>

      {selected && (
        <PlayerProfileModal player={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}