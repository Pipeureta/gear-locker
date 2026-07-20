'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentPlayer } from '@/lib/store';
import { useAuth } from '@/lib/auth-context';
import LoginScreen from '@/components/LoginScreen';
import ProfileEditor from '@/components/ProfileEditor';
import PendingApprovalScreen from '@/components/PendingApprovalScreen';

interface NavEntry {
  href: string;
  label: string;
  ico: string;
  group: 'Operaciones' | 'Equipo' | 'Admin';
  adminOnly?: boolean;
}

const NAV: NavEntry[] = [
  { href: '/', label: 'HQ', ico: '◈', group: 'Operaciones' },
  { href: '/eventos', label: 'Eventos', ico: '◎', group: 'Operaciones' },
  { href: '/roster', label: 'Roster', ico: '▣', group: 'Equipo' },
  { href: '/cuotas', label: 'Cuotas', ico: '◫', group: 'Equipo' },
  { href: '/comandancia', label: 'Comandancia', ico: '✦', group: 'Admin', adminOnly: true },
];

const GROUPS: NavEntry['group'][] = ['Operaciones', 'Equipo', 'Admin'];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { status, signOut, pendingRequest } = useAuth();
  const player = useCurrentPlayer();
  const [profileOpen, setProfileOpen] = useState(false);

  // Registro del service worker para modo PWA/offline.
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  if (status === 'loading') {
    return (
      <div className="lat-grid-bg">
        <div className="login-wrap">
          <span className="tiny mut">Cargando…</span>
        </div>
      </div>
    );
  }

  if (status === 'signed-out') {
    return <LoginScreen />;
  }

  if (status === 'pending') {
    return <PendingApprovalScreen request={pendingRequest} onSignOut={signOut} />;
  }

  const visibleNav = NAV.filter((n) => !n.adminOnly || player.isAdmin);
  const current = visibleNav.find((n) => isActive(pathname, n.href));

  return (
    <div className="lat-grid-bg">
      <div className="shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <img src="/logo.svg" alt="TSD" className="sidebar-logo" />
            <div>
              <span className="brand-title" style={{ display: 'block' }}>Gear Locker</span>
              <span className="brand-sub">Team Six Devgru</span>
            </div>
          </div>
          <nav className="sidebar-nav">
            {GROUPS.map((group) => {
              const items = visibleNav.filter((n) => n.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <div className="sidebar-group-label">{group}</div>
                  {items.map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`nav-item${isActive(pathname, n.href) ? ' active' : ''}`}
                    >
                      <span className="nav-ico">{n.ico}</span> {n.label}
                    </Link>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <button
              className="row profile-btn"
              onClick={() => setProfileOpen(true)}
              title="Ver y editar mi perfil"
            >
              <span className="avatar sm">
                {player.photoUrl ? <img src={player.photoUrl} alt={player.callsign} /> : player.callsign}
              </span>
              <span style={{ textAlign: 'left' }}>
                <span className="small acc" style={{ display: 'block' }}>{(player.nickname || player.name).toUpperCase()}</span>
                <span className="tiny dim-t">{player.callsign} · Mi perfil ✎</span>
              </span>
            </button>
            <button className="lat-btn ghost sm" onClick={signOut}>⏻ Cerrar sesión</button>
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <div className="page-title">
              <span className="crumb">TSD /</span> {current?.label ?? 'Briefing'}
            </div>
            <div className="row">
              <span className="lat-chip ok" title="App en línea — los datos se guardan por dispositivo hasta conectar Supabase">
                <span className="dot" /> Live
              </span>
              <button
                className="avatar sm avatar-btn"
                onClick={() => setProfileOpen(true)}
                title="Mi perfil"
              >
                {player.photoUrl ? <img src={player.photoUrl} alt={player.callsign} /> : player.callsign}
              </button>
              <button className="lat-btn ghost sm mobile-only" onClick={signOut} title="Cerrar sesión">⏻</button>
            </div>
          </header>
          <div className="content">{children}</div>
        </div>
      </div>

      <nav className="bottom-tabs">
        {visibleNav.map((n) => (
          <Link key={n.href} href={n.href} className={`tab${isActive(pathname, n.href) ? ' active' : ''}`}>
            <span className="nav-ico">{n.ico}</span>
            {n.label}
          </Link>
        ))}
      </nav>

      {profileOpen && <ProfileEditor onClose={() => setProfileOpen(false)} />}
    </div>
  );
}
