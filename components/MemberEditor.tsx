'use client';

// Modal de comandancia para crear o editar la ficha de un integrante.

import { useRef, useState } from 'react';
import ModalShell from '@/components/ModalShell';
import { ROLES, rolesForPlayer, type Player, type Rank, type MemberStatus, type Role } from '@/lib/data';
import { imageToDataUrl } from '@/lib/img';

const RANKS: Rank[] = ['Nuevo', 'Titular', 'Veterano'];
const STATUSES: MemberStatus[] = ['activo', 'receso', 'inactivo'];

export default function MemberEditor({
  initial,
  onSave,
  onClose,
}: {
  initial?: Player;
  onSave: (p: Omit<Player, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [nickname, setNickname] = useState(initial?.nickname ?? '');
  const [callsign, setCallsign] = useState(initial?.callsign ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [rank, setRank] = useState<Rank>(initial?.rank ?? 'Nuevo');
  const [status, setStatus] = useState<MemberStatus>(initial?.status ?? 'activo');
  const [usualRoles, setUsualRoles] = useState<Role[]>(initial ? rolesForPlayer(initial) : ['Rifleman']);
  const [isAdmin, setIsAdmin] = useState(initial?.isAdmin ?? false);
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPhotoUrl(await imageToDataUrl(f, 256));
    } catch {
      setMsg('No pudimos procesar esa imagen.');
    }
  };

  const save = () => {
    if (!name.trim() || !callsign.trim()) {
      setMsg('Nombre y callsign son obligatorios.');
      return;
    }
    if (usualRoles.length === 0) {
      setMsg('Selecciona al menos un rol habitual.');
      return;
    }
    onSave({
      name: name.trim(),
      nickname: nickname.trim() || undefined,
      callsign: callsign.trim().toUpperCase(),
      phone: phone.trim() || undefined,
      rank,
      status,
      usualRole: usualRoles[0],
      usualRoles,
      isAdmin,
      photoUrl,
      joinedAt: initial?.joinedAt ?? new Date().toISOString().slice(0, 10),
      loadout: initial?.loadout,
    });
  };

  return (
    <ModalShell onClose={onClose}>
        <h2>{initial ? `Editar — ${initial.callsign} ${initial.name}` : 'Agregar integrante'}</h2>

        <div className="photo-pick">
          <span className="avatar lg">
            {photoUrl ? <img src={photoUrl} alt="Foto" /> : callsign || '?'}
          </span>
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <button type="button" className="lat-btn ghost sm" onClick={() => fileRef.current?.click()}>
            {photoUrl ? 'Cambiar foto' : 'Subir foto'}
          </button>
        </div>

        <div className="grid cols-2 compact-grid">
          <div className="lat-field">
            <label>Nombre completo</label>
            <input className="lat-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="lat-field">
            <label>Nickname</label>
            <input className="lat-input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Opcional" />
          </div>
        </div>
        <div className="grid cols-2" style={{ gap: 10 }}>
          <div className="lat-field">
            <label>Callsign</label>
            <input className="lat-input" value={callsign} onChange={(e) => setCallsign(e.target.value)} placeholder="Ej: 15B9" />
          </div>
          <div className="lat-field">
            <label>Teléfono</label>
            <input className="lat-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 ..." />
          </div>
        </div>
        <div className="grid cols-2" style={{ gap: 10 }}>
          <div className="lat-field">
            <label>Rango</label>
            <select className="lat-select" value={rank} onChange={(e) => setRank(e.target.value as Rank)}>
              {RANKS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="lat-field">
            <label>Estado</label>
            <select className="lat-select" value={status} onChange={(e) => setStatus(e.target.value as MemberStatus)}>
              {STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="lat-field">
          <label>Roles habituales (puedes elegir varios)</label>
          <div className="role-picker">
            {ROLES.map((role) => (
              <label key={role} className={usualRoles.includes(role) ? 'selected' : ''}>
                <input
                  type="checkbox"
                  checked={usualRoles.includes(role)}
                  onChange={(e) =>
                    setUsualRoles((prev) =>
                      e.target.checked ? [...prev, role] : prev.filter((item) => item !== role),
                    )
                  }
                />
                {role}
              </label>
            ))}
          </div>
        </div>
        <div className="grid cols-2" style={{ gap: 10 }}>
          <div className="lat-field">
            <label>Comandancia</label>
            <select className="lat-select" value={isAdmin ? 'sí' : 'no'} onChange={(e) => setIsAdmin(e.target.value === 'sí')}>
              <option value="no">No</option>
              <option value="sí">Sí — acceso admin</option>
            </select>
          </div>
        </div>

        {msg && <div className="lat-alert warn"><span className="help">{msg}</span></div>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="lat-btn ghost" onClick={onClose}>Cancelar</button>
          <button className="lat-btn primary" onClick={save}>Guardar</button>
        </div>
    </ModalShell>
  );
}
