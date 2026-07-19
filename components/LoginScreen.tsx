'use client';

import { useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { imageToDataUrl } from '@/lib/img';

type AccessTab = 'login' | 'registro' | 'recuperar';

export default function LoginScreen() {
  const {
    login,
    submitRegistration,
    players,
    requestPasswordReset,
    completePasswordReset,
  } = useStore();
  const [tab, setTab] = useState<AccessTab>('login');

  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loginMsg, setLoginMsg] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [regPass, setRegPass] = useState('');
  const [regPassConfirm, setRegPassConfirm] = useState('');
  const [regMsg, setRegMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [recoveryUser, setRecoveryUser] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<'solicitar' | 'nueva-clave'>('solicitar');
  const [recoveryPass, setRecoveryPass] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);
  const [recoveryDone, setRecoveryDone] = useState(false);

  const switchTab = (next: AccessTab) => {
    setTab(next);
    setLoginMsg(null);
    setRegMsg(null);
    setRecoveryMsg(null);
  };

  const doLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim()) {
      setLoginMsg('Escribe tu callsign.');
      return;
    }
    const res = login(user, pass);
    if (res === 'ok') return;
    if (res === 'restablecimiento-aprobado') {
      setRecoveryUser(user);
      setRecoveryStep('nueva-clave');
      setTab('recuperar');
      setRecoveryMsg('Comandancia aprobó tu solicitud. Elige una contraseña nueva.');
      return;
    }
    const messages = {
      pendiente: 'Tu registro todavía está esperando la aprobación de Comandancia.',
      'clave-incorrecta': 'La contraseña no es correcta. Puedes intentar nuevamente o solicitar recuperarla.',
      'no-encontrado': 'No encontramos ese callsign. Revisa cómo lo escribiste o crea una cuenta en Registro.',
    } as const;
    setLoginMsg(messages[res]);
  };

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await imageToDataUrl(file, 256));
      setRegMsg(null);
    } catch {
      setRegMsg('No pudimos procesar esa imagen. Intenta con otra foto (JPG o PNG).');
    }
  };

  const doRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !callsign.trim() || !phone.trim()) {
      setRegMsg('Completa tu nombre, callsign y teléfono para enviar la solicitud.');
      return;
    }
    if (regPass.length < 8) {
      setRegMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (regPass !== regPassConfirm) {
      setRegMsg('Las contraseñas no coinciden.');
      return;
    }
    const result = submitRegistration({
      name: name.trim(),
      callsign: callsign.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim(),
      photoUrl: photo,
      password: regPass,
    });
    if (result === 'duplicada') {
      setRegMsg('Ya existe una solicitud pendiente para ese callsign.');
      return;
    }
    setSent(true);
  };

  const requestReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryUser.trim()) {
      setRecoveryMsg('Escribe tu callsign, nickname o nombre.');
      return;
    }
    const result = requestPasswordReset(recoveryUser);
    if (result === 'no-encontrado') {
      setRecoveryMsg('No encontramos un integrante con esos datos.');
    } else if (result === 'aprobada') {
      setRecoveryStep('nueva-clave');
      setRecoveryMsg('La solicitud fue aprobada. Elige una contraseña nueva.');
    } else if (result === 'ya-pendiente') {
      setRecoveryMsg('La solicitud sigue pendiente. Comandancia debe aprobarla antes de continuar.');
    } else {
      setRecoveryMsg('Solicitud enviada. Cuando Comandancia la apruebe, vuelve aquí y presiona “Revisar aprobación”.');
    }
  };

  const finishReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (recoveryPass.length < 8) {
      setRecoveryMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (recoveryPass !== recoveryConfirm) {
      setRecoveryMsg('Las contraseñas no coinciden.');
      return;
    }
    const result = completePasswordReset(recoveryUser, recoveryPass);
    if (result !== 'ok') {
      setRecoveryStep('solicitar');
      setRecoveryMsg(
        result === 'no-encontrado'
          ? 'No encontramos ese integrante.'
          : 'La solicitud todavía no ha sido aprobada por Comandancia.',
      );
      return;
    }
    setRecoveryDone(true);
    setRecoveryMsg(null);
  };

  const matchedPlayer = players.find(
    (player) => player.callsign.toLowerCase() === callsign.trim().toLowerCase(),
  );

  return (
    <div className="lat-grid-bg">
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-brand">
            <img src="/logo.svg" alt="Team Six Devgru" className="login-logo" />
            <div className="lb-title">Gear Locker</div>
            <div className="lb-sub">Team Six Devgru</div>
          </div>

          <div className="login-tabs three">
            <button className={tab === 'login' ? 'active' : ''} onClick={() => switchTab('login')}>Ingresar</button>
            <button className={tab === 'registro' ? 'active' : ''} onClick={() => switchTab('registro')}>Registro</button>
            <button className={tab === 'recuperar' ? 'active' : ''} onClick={() => switchTab('recuperar')}>Recuperar</button>
          </div>

          {tab === 'login' && (
            <form onSubmit={doLogin} className="form-stack">
              <div className="lat-field">
                <label>Callsign</label>
                <input
                  className="lat-input"
                  value={user}
                  onChange={(e) => { setUser(e.target.value); setLoginMsg(null); }}
                  placeholder="Tu callsign"
                  autoFocus
                />
              </div>
              <div className="lat-field">
                <label>Contraseña</label>
                <input
                  className="lat-input"
                  type="password"
                  value={pass}
                  onChange={(e) => { setPass(e.target.value); setLoginMsg(null); }}
                  placeholder="••••••••"
                />
                <span className="help">¿Primera vez? Pide tu clave temporal a comandancia.</span>
              </div>
              {loginMsg && <div className="lat-alert warn">{loginMsg}</div>}
              <button className="lat-btn primary" type="submit">Entrar</button>
              <button type="button" className="lat-btn ghost" onClick={() => { setRecoveryUser(user); switchTab('recuperar'); }}>
                Olvidé mi contraseña
              </button>
            </form>
          )}

          {tab === 'registro' && (sent ? (
            <div className="lat-alert ok">
              <div className="alert-title">Solicitud enviada</div>
              <span className="help">Comandancia debe aprobarla antes de que puedas ingresar con tu callsign y contraseña.</span>
            </div>
          ) : (
            <form onSubmit={doRegister} className="form-stack">
              <span className="help">Nombre, callsign, teléfono y contraseña son obligatorios. Nickname y foto pueden completarse después.</span>
              <div className="lat-field">
                <label>Nombre completo</label>
                <input className="lat-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Juan Pérez Soto" />
              </div>
              <div className="grid cols-2 compact-grid">
                <div className="lat-field">
                  <label>Callsign</label>
                  <input className="lat-input" value={callsign} onChange={(e) => { setCallsign(e.target.value); setRegMsg(null); }} placeholder="Ej: 15B9" />
                </div>
                <div className="lat-field">
                  <label>Nickname (opcional)</label>
                  <input className="lat-input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Ej: Cóndor" />
                </div>
              </div>
              {callsign.trim() && (
                <span className={`help ${matchedPlayer ? 'okc' : ''}`}>
                  {matchedPlayer
                    ? `Se solicitará vincular tu cuenta con la ficha ${matchedPlayer.callsign} de ${matchedPlayer.name}.`
                    : 'Si Comandancia aprueba la solicitud, se creará una ficha nueva.'}
                </span>
              )}
              <div className="lat-field">
                <label>Teléfono</label>
                <input className="lat-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 ..." />
              </div>
              <div className="grid cols-2 compact-grid">
                <div className="lat-field">
                  <label>Contraseña</label>
                  <input className="lat-input" type="password" value={regPass} onChange={(e) => setRegPass(e.target.value)} placeholder="Mínimo 8 caracteres" />
                </div>
                <div className="lat-field">
                  <label>Repetir contraseña</label>
                  <input className="lat-input" type="password" value={regPassConfirm} onChange={(e) => setRegPassConfirm(e.target.value)} placeholder="Repite tu contraseña" />
                </div>
              </div>
              <div className="lat-field">
                <label>Foto de perfil (opcional)</label>
                <div className="photo-pick">
                  <span className="avatar lg">{photo ? <img src={photo} alt="Foto de perfil" /> : '?'}</span>
                  <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                  <button type="button" className="lat-btn ghost sm" onClick={() => fileRef.current?.click()}>
                    {photo ? 'Cambiar foto' : 'Elegir foto'}
                  </button>
                </div>
              </div>
              {regMsg && <div className="lat-alert warn">{regMsg}</div>}
              <button className="lat-btn primary" type="submit">Enviar solicitud</button>
            </form>
          ))}

          {tab === 'recuperar' && (recoveryDone ? (
            <div className="form-stack">
              <div className="lat-alert ok">
                <div className="alert-title">Contraseña actualizada</div>
                <span className="help">Ya puedes ingresar con tu nueva contraseña.</span>
              </div>
              <button className="lat-btn primary" onClick={() => { setUser(recoveryUser); switchTab('login'); }}>Volver a ingresar</button>
            </div>
          ) : recoveryStep === 'solicitar' ? (
            <form onSubmit={requestReset} className="form-stack">
              <span className="help">Comandancia debe aprobar el restablecimiento. Nadie podrá ver tu contraseña anterior.</span>
              <div className="lat-field">
                <label>Callsign</label>
                <input className="lat-input" value={recoveryUser} onChange={(e) => { setRecoveryUser(e.target.value); setRecoveryMsg(null); }} placeholder="Tu callsign" autoFocus />
              </div>
              {recoveryMsg && <div className="lat-alert warn">{recoveryMsg}</div>}
              <button className="lat-btn primary" type="submit">Solicitar recuperación</button>
              <button className="lat-btn ghost" type="submit">Revisar aprobación</button>
            </form>
          ) : (
            <form onSubmit={finishReset} className="form-stack">
              <div className="lat-alert ok"><span className="help">Solicitud aprobada para <strong>{recoveryUser}</strong>.</span></div>
              <div className="lat-field">
                <label>Nueva contraseña</label>
                <input className="lat-input" type="password" value={recoveryPass} onChange={(e) => setRecoveryPass(e.target.value)} placeholder="Mínimo 8 caracteres" autoFocus />
              </div>
              <div className="lat-field">
                <label>Repetir nueva contraseña</label>
                <input className="lat-input" type="password" value={recoveryConfirm} onChange={(e) => setRecoveryConfirm(e.target.value)} placeholder="Repite tu contraseña" />
              </div>
              {recoveryMsg && <div className="lat-alert warn">{recoveryMsg}</div>}
              <button className="lat-btn primary" type="submit">Guardar nueva contraseña</button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}