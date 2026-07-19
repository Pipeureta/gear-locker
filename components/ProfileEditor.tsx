'use client';

// Panel "Mi perfil": cada integrante ve sus datos y edita su información
// personal (nombre, teléfono y foto). Callsign, rango y rol los administra
// comandancia.

import { useRef, useState } from 'react';
import { attendancePct, pastEvents, rolesForPlayer } from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';
import { imageToDataUrl } from '@/lib/img';

export default function ProfileEditor({ onClose }: { onClose: () => void }) {
  const player = useCurrentPlayer();
  const { updatePlayer, players, changePassword } = useStore();
  const [name, setName] = useState(player.name);
  const [callsign, setCallsign] = useState(player.callsign);
  const [nickname, setNickname] = useState(player.nickname ?? '');
  const [phone, setPhone] = useState(player.phone ?? '');
  const [photoUrl, setPhotoUrl] = useState(player.photoUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attendance = attendancePct(player.id);
  const history = pastEvents();
  const attended = history.filter((event) => event.attended?.includes(player.id)).length;

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPhotoUrl(await imageToDataUrl(f, 256));
      setSaved(false);
    } catch {
      setMsg('No pudimos procesar esa imagen. Intenta con otra (JPG o PNG).');
    }
  };

  const save = () => {
    if (!name.trim() || !callsign.trim()) {
      setMsg('Tu nombre y callsign no pueden quedar vacíos.');
      return;
    }
    if (players.some((item) => item.id !== player.id && item.callsign.toLowerCase() === callsign.trim().toLowerCase())) {
      setMsg('Ese callsign ya está siendo usado por otro integrante.');
      return;
    }
    updatePlayer(player.id, {
      name: name.trim(),
      callsign: callsign.trim().toUpperCase(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim() || undefined,
      photoUrl,
    });
    setMsg(null);
    setSaved(true);
  };

  const savePassword = () => {
    if (newPassword.length < 8) {
      setPasswordMsg({ text: 'La contraseña nueva debe tener al menos 8 caracteres.', ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Las contraseñas nuevas no coinciden.', ok: false });
      return;
    }
    const result = changePassword(player.id, currentPassword, newPassword);
    if (result === 'clave-incorrecta') {
      setPasswordMsg({ text: 'La contraseña actual no es correcta.', ok: false });
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMsg({ text: 'Contraseña actualizada correctamente.', ok: true });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Mi perfil</h2>

        <div className="photo-pick">
          <span className="avatar lg">
            {photoUrl ? <img src={photoUrl} alt="Mi foto" /> : player.callsign}
          </span>
          <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <button type="button" className="lat-btn ghost sm" onClick={() => fileRef.current?.click()}>
            {photoUrl ? 'Cambiar foto' : 'Subir foto'}
          </button>
        </div>

        <div className="lat-field">
          <label>Nombre completo</label>
          <input className="lat-input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </div>
        <div className="grid cols-2 compact-grid">
          <div className="lat-field">
            <label>Callsign</label>
            <input className="lat-input" value={callsign} onChange={(e) => { setCallsign(e.target.value); setSaved(false); }} />
          </div>
          <div className="lat-field">
            <label>Nickname</label>
            <input className="lat-input" value={nickname} onChange={(e) => { setNickname(e.target.value); setSaved(false); }} placeholder="Puedes completarlo después" />
          </div>
        </div>
        <div className="lat-field">
          <label>Teléfono</label>
          <input className="lat-input" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} placeholder="+56 9 ..." />
        </div>

        <div className="profile-stat">
          <div>
            <span className="profile-stat-label">Mi asistencia</span>
            <strong className={attendance >= 70 ? 'okc' : attendance >= 40 ? 'warnc' : 'critc'}>
              {attendance}%
            </strong>
          </div>
          <div className="profile-stat-track">
            <span className={attendance >= 70 ? 'ok' : attendance >= 40 ? 'warn' : 'crit'} style={{ width: `${attendance}%` }} />
          </div>
          <span className="help">{attended} de {history.length} eventos registrados.</span>
        </div>

        <div>
          <div className="tiny dim-t" style={{ marginBottom: 4 }}>Datos administrados por comandancia</div>
          <div className="kv"><span className="k">Rango</span><span className="v">{player.rank}</span></div>
          <div className="kv"><span className="k">Roles habituales</span><span className="v">{rolesForPlayer(player).join(' · ')}</span></div>
          <div className="kv"><span className="k">En el equipo desde</span><span className="v">{player.joinedAt.slice(0, 7)}</span></div>
        </div>

        <div className="profile-password">
          <div className="panel-head"><h3>Seguridad</h3></div>
          <div className="lat-field">
            <label>Contraseña actual</label>
            <input className="lat-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Tu contraseña actual" />
          </div>
          <div className="grid cols-2 compact-grid">
            <div className="lat-field">
              <label>Nueva contraseña</label>
              <input className="lat-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="lat-field">
              <label>Repetir contraseña</label>
              <input className="lat-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite la nueva clave" />
            </div>
          </div>
          {passwordMsg && <div className={`lat-alert ${passwordMsg.ok ? 'ok' : 'warn'}`}><span className="help">{passwordMsg.text}</span></div>}
          <button className="lat-btn" type="button" onClick={savePassword}>Actualizar contraseña</button>
        </div>

        {msg && <div className="lat-alert warn"><span className="help">{msg}</span></div>}
        {saved && <div className="lat-alert ok"><span className="help">Cambios guardados. ✔</span></div>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="lat-btn ghost" onClick={onClose}>Cerrar</button>
          <button className="lat-btn primary" onClick={save}>Guardar cambios</button>
        </div>
      </div>
    </div>
  );
}
