'use client';

// Panel "Mi perfil": cada integrante ve sus datos y edita su información
// personal (nombre, teléfono y foto). Callsign, rango y rol los administra
// comandancia. Guarda directo contra Supabase (players + Auth), a
// diferencia del resto de la app que todavía vive en el store local.

import { useRef, useState } from 'react';
import ModalShell from '@/components/ModalShell';
import { attendancePct, pastEvents, rolesForPlayer, ROLES, type PrimaryWeapon, type Role } from '@/lib/data';
import { useCurrentPlayer } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import { useGearChecklist } from '@/lib/gear-checklist';
import { createClient } from '@/lib/supabase/client';

export default function ProfileEditor({ onClose }: { onClose: () => void }) {
  const player = useCurrentPlayer();
  const { authUser, supaPlayer, refreshPlayer } = useAuth();
  const { items: gearChecklist } = useGearChecklist();
  const [primaries, setPrimaries] = useState<PrimaryWeapon[]>(player.primaries ?? []);
  const [gear, setGear] = useState<Record<string, boolean>>(player.gear ?? {});
  const [name, setName] = useState(player.name);
  const [nickname, setNickname] = useState(player.nickname ?? '');
  const [phone, setPhone] = useState(player.phone ?? '');
  const [photoUrl, setPhotoUrl] = useState(player.photoUrl);
  const [photoFile, setPhotoFile] = useState<File | undefined>();
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const attendance = attendancePct(player.id);
  const history = pastEvents();
  const attended = history.filter((event) => event.attended?.includes(player.id)).length;

  const pickPhoto = (f: File | undefined) => {
    if (!f) return;
    setPhotoFile(f);
    setPhotoUrl(URL.createObjectURL(f));
    setSaved(false);
  };

  const save = async () => {
    if (!authUser || !supaPlayer) return;
    if (!name.trim()) {
      setMsg('Tu nombre no puede quedar vacío.');
      return;
    }
    setSaving(true);
    setMsg(null);
    const supabase = createClient();

    let uploadedUrl: string | undefined;
    if (photoFile) {
      const path = `${authUser.id}/${Date.now()}-${photoFile.name}`;
      const { error: upErr } = await supabase.storage.from('player-photos').upload(path, photoFile, { upsert: true });
      if (upErr) {
        setSaving(false);
        setMsg('No se pudo subir la foto: ' + upErr.message);
        return;
      }
      uploadedUrl = supabase.storage.from('player-photos').getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase
      .from('players')
      .update({
        name: name.trim(),
        nickname: nickname.trim() || null,
        phone: phone.trim() || null,
        photo_url: uploadedUrl ?? photoUrl ?? null,
        primaries: primaries.map((p) => ({ ...p, name: p.name.trim() })).filter((p) => p.name),
        gear,
      })
      .eq('user_id', authUser.id);

    setSaving(false);
    if (error) {
      setMsg('No se pudo guardar: ' + error.message);
      return;
    }
    await refreshPlayer();
    setSaved(true);
  };

  const setPrimary = (index: number, patch: Partial<PrimaryWeapon>) => {
    setPrimaries((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
    setSaved(false);
  };

  const savePassword = async () => {
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'La contraseña nueva debe tener al menos 6 caracteres.', ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'Las contraseñas nuevas no coinciden.', ok: false });
      return;
    }
    setPasswordBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordBusy(false);
    if (error) {
      setPasswordMsg({ text: error.message, ok: false });
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMsg({ text: 'Contraseña actualizada correctamente.', ok: true });
  };

  return (
    <ModalShell onClose={onClose}>
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
            <input className="lat-input" value={player.callsign} disabled title="Solo comandancia puede cambiar tu callsign" />
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
        <div className="lat-field">
          <label>Correo</label>
          <input className="lat-input" value={authUser?.email ?? ''} disabled title="Cambiar el correo llega pronto" />
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

        <div className="profile-gear">
          <div className="panel-head"><h3>Mis primarias</h3></div>
          <span className="help">Registra tus réplicas primarias y el rol con el que usas cada una.</span>
          {primaries.length === 0 && (
            <div className="empty-state">Aún no registras primarias. Agrega la primera. 🔫</div>
          )}
          {primaries.map((p, i) => (
            <div key={i} className="primary-row">
              <input
                className="lat-input"
                value={p.name}
                onChange={(e) => setPrimary(i, { name: e.target.value })}
                placeholder="Ej: M4 Specna Arsenal SA-E20"
              />
              <select
                className="lat-select"
                value={p.role}
                onChange={(e) => setPrimary(i, { role: e.target.value as Role })}
              >
                {ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button
                className="lat-btn danger sm"
                type="button"
                title="Quitar esta primaria"
                onClick={() => { setPrimaries((prev) => prev.filter((_, x) => x !== i)); setSaved(false); }}
              >
                ✗
              </button>
            </div>
          ))}
          <button
            className="lat-btn ghost sm"
            type="button"
            onClick={() => { setPrimaries((prev) => [...prev, { name: '', role: 'Rifleman' }]); setSaved(false); }}
          >
            + Agregar primaria
          </button>
        </div>

        <div className="profile-gear">
          <div className="panel-head"><h3>Mi equipo personal</h3></div>
          <span className="help">Marca lo que ya tienes. La lista la define comandancia.</span>
          <div className="gear-grid">
            {gearChecklist.map((item) => (
              <label key={item} className={`gear-check${gear[item] ? ' on' : ''}`}>
                <input
                  type="checkbox"
                  checked={!!gear[item]}
                  onChange={(e) => { setGear((prev) => ({ ...prev, [item]: e.target.checked })); setSaved(false); }}
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
          {gearChecklist.length > 0 && (
            <span className="tiny mut">
              {gearChecklist.filter((i) => gear[i]).length}/{gearChecklist.length} items — recuerda Guardar cambios.
            </span>
          )}
        </div>

        <div className="profile-password">
          <div className="panel-head"><h3>Seguridad</h3></div>
          <div className="grid cols-2 compact-grid">
            <div className="lat-field">
              <label>Nueva contraseña</label>
              <input className="lat-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="lat-field">
              <label>Repetir contraseña</label>
              <input className="lat-input" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repite la nueva clave" />
            </div>
          </div>
          {passwordMsg && <div className={`lat-alert ${passwordMsg.ok ? 'ok' : 'warn'}`}><span className="help">{passwordMsg.text}</span></div>}
          <button className="lat-btn" type="button" onClick={savePassword} disabled={passwordBusy}>
            {passwordBusy ? 'Guardando...' : 'Actualizar contraseña'}
          </button>
        </div>

        {msg && <div className="lat-alert warn"><span className="help">{msg}</span></div>}
        {saved && <div className="lat-alert ok"><span className="help">Cambios guardados. ✔</span></div>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="lat-btn ghost" onClick={onClose}>Cerrar</button>
          <button className="lat-btn primary" onClick={save} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
    </ModalShell>
  );
}
