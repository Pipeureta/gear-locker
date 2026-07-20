'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

type AccessTab = 'login' | 'registro' | 'recuperar';

export default function LoginScreen() {
  const { signIn, register, requestPasswordReset } = useAuth();
  const [tab, setTab] = useState<AccessTab>('login');
  const [busy, setBusy] = useState(false);

  // ---- ingresar ----
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loginMsg, setLoginMsg] = useState<string | null>(null);

  // ---- registro ----
  const [name, setName] = useState('');
  const [callsign, setCallsign] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPassConfirm, setRegPassConfirm] = useState('');
  const [photoFile, setPhotoFile] = useState<File | undefined>();
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [regMsg, setRegMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ---- recuperar ----
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);
  const [recoverySent, setRecoverySent] = useState(false);

  const switchTab = (next: AccessTab) => {
    setTab(next);
    setLoginMsg(null);
    setRegMsg(null);
    setRecoveryMsg(null);
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !pass) {
      setLoginMsg('Escribe tu correo y tu contraseña.');
      return;
    }
    setBusy(true);
    const { error } = await signIn(email.trim(), pass);
    setBusy(false);
    if (error) setLoginMsg(error);
  };

  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !callsign.trim() || !phone.trim() || !regEmail.trim()) {
      setRegMsg('Completa tu nombre, callsign, teléfono y correo para enviar la solicitud.');
      return;
    }
    if (regPass.length < 6) {
      setRegMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (regPass !== regPassConfirm) {
      setRegMsg('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    const { error } = await register({
      email: regEmail.trim(),
      password: regPass,
      name: name.trim(),
      callsign: callsign.trim(),
      nickname: nickname.trim() || undefined,
      phone: phone.trim(),
      photoFile,
    });
    setBusy(false);
    if (error) {
      setRegMsg(error);
      return;
    }
    setSent(true);
  };

  const doRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      setRecoveryMsg('Escribe el correo con el que te registraste.');
      return;
    }
    setBusy(true);
    const { error } = await requestPasswordReset(recoveryEmail.trim());
    setBusy(false);
    if (error) {
      setRecoveryMsg(error);
      return;
    }
    setRecoverySent(true);
  };

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
                <label>Correo</label>
                <input
                  className="lat-input"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setLoginMsg(null); }}
                  placeholder="tu@correo.com"
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
              </div>
              {loginMsg && <div className="lat-alert warn">{loginMsg}</div>}
              <button className="lat-btn primary" type="submit" disabled={busy}>
                {busy ? 'Entrando...' : 'Entrar'}
              </button>
              <button type="button" className="lat-btn ghost" onClick={() => { setRecoveryEmail(email); switchTab('recuperar'); }}>
                Olvidé mi contraseña
              </button>
            </form>
          )}

          {tab === 'registro' && (sent ? (
            <div className="lat-alert ok">
              <div className="alert-title">Solicitud enviada</div>
              <span className="help">
                Revisa tu correo si comandancia aún exige confirmarlo. Cuando aprueben tu solicitud, entras con tu correo y contraseña.
              </span>
            </div>
          ) : (
            <form onSubmit={doRegister} className="form-stack">
              <span className="help">Completa tus datos. Si tu callsign coincide con una ficha ya cargada por comandancia, tu cuenta la tomará al ser aprobada.</span>
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
              <div className="lat-field">
                <label>Teléfono</label>
                <input className="lat-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 ..." />
              </div>
              <div className="lat-field">
                <label>Correo</label>
                <input className="lat-input" type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} placeholder="tu@correo.com" />
              </div>
              <div className="grid cols-2 compact-grid">
                <div className="lat-field">
                  <label>Contraseña</label>
                  <input className="lat-input" type="password" value={regPass} onChange={(e) => setRegPass(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="lat-field">
                  <label>Repetir contraseña</label>
                  <input className="lat-input" type="password" value={regPassConfirm} onChange={(e) => setRegPassConfirm(e.target.value)} placeholder="Repite tu contraseña" />
                </div>
              </div>
              <div className="lat-field">
                <label>Foto de perfil (opcional)</label>
                <div className="photo-pick">
                  <span className="avatar lg">{photoPreview ? <img src={photoPreview} alt="Foto de perfil" /> : '?'}</span>
                  <input ref={fileRef} type="file" accept="image/*" onChange={(e) => pickPhoto(e.target.files?.[0])} />
                  <button type="button" className="lat-btn ghost sm" onClick={() => fileRef.current?.click()}>
                    {photoPreview ? 'Cambiar foto' : 'Elegir foto'}
                  </button>
                </div>
              </div>
              {regMsg && <div className="lat-alert warn">{regMsg}</div>}
              <button className="lat-btn primary" type="submit" disabled={busy}>
                {busy ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </form>
          ))}

          {tab === 'recuperar' && (recoverySent ? (
            <div className="form-stack">
              <div className="lat-alert ok">
                <div className="alert-title">Correo enviado</div>
                <span className="help">Revisa tu bandeja de entrada — el enlace te deja elegir una contraseña nueva.</span>
              </div>
              <button className="lat-btn ghost" onClick={() => { setRecoverySent(false); switchTab('login'); }}>Volver a ingresar</button>
            </div>
          ) : (
            <form onSubmit={doRequestReset} className="form-stack">
              <span className="help">Te enviamos un enlace para elegir una contraseña nueva.</span>
              <div className="lat-field">
                <label>Correo</label>
                <input
                  className="lat-input"
                  type="email"
                  value={recoveryEmail}
                  onChange={(e) => { setRecoveryEmail(e.target.value); setRecoveryMsg(null); }}
                  placeholder="tu@correo.com"
                  autoFocus
                />
              </div>
              {recoveryMsg && <div className="lat-alert warn">{recoveryMsg}</div>}
              <button className="lat-btn primary" type="submit" disabled={busy}>
                {busy ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
