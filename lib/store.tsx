'use client';

// Estado de cliente para el modo demo. Todo lo que aquí vive en localStorage
// (integrantes, cuotas, avisos, solicitudes, comprobantes, archivos de evento)
// se reemplaza por Supabase (Postgres + Storage + Auth) al conectar la base:
// las estructuras calzan 1:1 con supabase/schema.sql.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ADMIN_NOTES,
  DUES,
  DUE_AMOUNT,
  EVENTS,
  INVENTORY,
  PLAYERS,
  PROCUREMENTS,
  SEED_ANNOUNCEMENTS,
  type Announcement,
  type Due,
  type GameEvent,
  type InventoryItem,
  type Player,
  type Procurement,
  type RsvpStatus,
} from './data';

export interface Registration {
  id: string;
  name: string;
  callsign: string;
  nickname?: string;
  phone: string;
  photoUrl?: string;
  password: string;
  // Ficha de la nómina que esta cuenta solicita reclamar. Comandancia debe
  // aprobar la vinculación antes de que el usuario pueda ingresar con ella.
  matchedPlayerId?: string;
  requestedAt: string;
}

export interface Receipt {
  id: string;
  playerId: string;
  month: string; // 'YYYY-MM'
  filename: string;
  dataUrl: string;
  uploadedAt: string;
  status: 'revision' | 'aceptado';
}

export interface PasswordResetRequest {
  id: string;
  playerId: string;
  requestedAt: string;
  status: 'pendiente' | 'aprobada';
}

export interface UploadedEventFile {
  id: string;
  eventId: string;
  name: string;
  kind: 'mapa' | 'documento' | 'imagen';
  dataUrl: string;
  size: string;
}

interface StoreState {
  // Sesión demo. En producción las credenciales viven en Supabase Auth.
  sessionPlayerId: string | null;
  login: (callsignOrName: string, password: string) =>
    'ok' | 'no-encontrado' | 'pendiente' | 'clave-incorrecta' | 'restablecimiento-aprobado';
  logout: () => void;
  changePassword: (playerId: string, currentPassword: string, newPassword: string) =>
    'ok' | 'clave-incorrecta';
  passwordResets: PasswordResetRequest[];
  requestPasswordReset: (callsignOrName: string) => 'enviada' | 'no-encontrado' | 'ya-pendiente' | 'aprobada';
  approvePasswordReset: (id: string) => void;
  rejectPasswordReset: (id: string) => void;
  completePasswordReset: (callsignOrName: string, newPassword: string) => 'ok' | 'no-aprobada' | 'no-encontrado';

  players: Player[];
  playerById: (id: string) => Player | undefined;
  addPlayer: (p: Player) => void;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  removePlayer: (id: string) => void;

  events: GameEvent[];
  addEvent: (event: Omit<GameEvent, 'id'>) => string;
  updateEvent: (id: string, event: Omit<GameEvent, 'id'>) => void;
  removeEvent: (id: string) => void;
  adminNotes: Record<string, string>;
  setAdminNote: (playerId: string, note: string) => void;
  removeAdminNote: (playerId: string) => void;

  dues: Due[];
  setDuePaid: (playerId: string, month: string, paid: boolean) => void;
  collectionAdjustment: number;
  setCollectionTotal: (total: number) => void;

  rsvps: Record<string, Record<string, RsvpStatus>>;
  setRsvp: (eventId: string, playerId: string, status: RsvpStatus) => void;

  announcements: Announcement[];
  addAnnouncement: (a: Omit<Announcement, 'id' | 'date'>) => void;
  updateAnnouncement: (id: string, patch: Omit<Announcement, 'id' | 'date'>) => void;
  removeAnnouncement: (id: string) => void;

  registrations: Registration[];
  submitRegistration: (r: Omit<Registration, 'id' | 'requestedAt' | 'matchedPlayerId'>) => 'enviada' | 'duplicada';
  approveRegistration: (id: string) => void;
  rejectRegistration: (id: string) => void;

  receipts: Receipt[];
  addReceipt: (playerId: string, month: string, filename: string, dataUrl: string) => void;
  acceptReceipt: (id: string) => void;

  eventUploads: UploadedEventFile[];
  addEventUpload: (f: Omit<UploadedEventFile, 'id'>) => void;
  removeEventUpload: (id: string) => void;

  inventory: InventoryItem[];
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (originalName: string, item: InventoryItem) => void;
  removeInventoryItem: (name: string) => void;
  procurements: Procurement[];
  addProcurement: (item: Procurement) => void;
  updateProcurement: (originalItem: string, item: Procurement) => void;
  removeProcurement: (item: string) => void;

  adminView: boolean;
  setAdminView: (v: boolean) => void;
}

const DEFAULT_RSVPS: Record<string, Record<string, RsvpStatus>> = {
  'e-milsim-atacama': {
    '1b9': 'va', '2b9': 'va', '3b9': 'va', '5b9': 'va', '7b9': 'va',
    '8b9': 'va', '9b9': 'va', '12b9': 'va', '13b9': 'va', '14b9': 'va',
    '4b9': 'no-va', '10b9': 'tal-vez',
  },
  'e-skirmish-jul': {
    '1b9': 'va', '2b9': 'va', '5b9': 'va', '12b9': 'va',
    '13b9': 'tal-vez', '14b9': 'va', '9b9': 'no-va',
  },
  'e-entrenamiento-ago': {
    '12b9': 'va', '5b9': 'va', '13b9': 'tal-vez', '14b9': 'va',
  },
};

const StoreCtx = createContext<StoreState | null>(null);

const TEMPORARY_PASSWORD = 'TSD2026!';
const DEFAULT_CREDENTIALS: Record<string, string> = Object.fromEntries(
  PLAYERS.map((player) => [player.id, TEMPORARY_PASSWORD]),
);

const LS_KEY = 'gear-locker-tsd-v3'; // versionado: invalida estados de versiones anteriores

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>(PLAYERS);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>(ADMIN_NOTES);
  const [events, setEvents] = useState<GameEvent[]>(EVENTS);
  const [credentials, setCredentials] = useState<Record<string, string>>(DEFAULT_CREDENTIALS);
  const [passwordResets, setPasswordResets] = useState<PasswordResetRequest[]>([]);
  const [dues, setDues] = useState<Due[]>(DUES);
  // Ajuste manual sobre la suma de cuotas pagadas. Permite que comandancia
  // concilie el total real sin perder la actualización automática por cuotas.
  const [collectionAdjustment, setCollectionAdjustment] = useState(0);
  const [rsvps, setRsvps] = useState(DEFAULT_RSVPS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(SEED_ANNOUNCEMENTS);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [eventUploads, setEventUploads] = useState<UploadedEventFile[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>(INVENTORY);
  const [procurements, setProcurements] = useState<Procurement[]>(PROCUREMENTS);
  const [adminView, setAdminView] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const apply = (raw: string | null, includeSession: boolean) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        if (includeSession && 'sessionPlayerId' in s) setSessionPlayerId(s.sessionPlayerId);
        if (s.players) setPlayers(s.players);
        if (s.adminNotes) setAdminNotes(s.adminNotes);
        if (s.events) setEvents(s.events);
        if (s.credentials) setCredentials(s.credentials);
        if (s.passwordResets) setPasswordResets(s.passwordResets);
        if (s.dues) setDues(s.dues);
        if (typeof s.collectionAdjustment === 'number') setCollectionAdjustment(s.collectionAdjustment);
        if (s.rsvps) setRsvps(s.rsvps);
        if (s.announcements) setAnnouncements(s.announcements);
        if (s.registrations) setRegistrations(s.registrations);
        if (s.receipts) setReceipts(s.receipts);
        if (s.eventUploads) setEventUploads(s.eventUploads);
        if (s.inventory) setInventory(s.inventory);
        if (s.procurements) setProcurements(s.procurements);
        if (includeSession && typeof s.adminView === 'boolean') setAdminView(s.adminView);
      } catch {
        /* estado corrupto — se ignora */
      }
    };

    apply(localStorage.getItem(LS_KEY), true);
    loaded.current = true;

    // Sincronización en vivo entre pestañas/ventanas del mismo navegador:
    // cualquier cambio hecho en otra pestaña se refleja aquí sin recargar.
    // (Entre dispositivos distintos, esto lo hará Supabase Realtime.)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) apply(e.newValue, false);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          sessionPlayerId, players, adminNotes, events, credentials, passwordResets, dues, collectionAdjustment,
          rsvps, announcements, registrations, receipts, eventUploads, inventory,
          procurements, adminView,
        }),
      );
    } catch {
      /* cuota de localStorage excedida — el estado sigue en memoria */
    }
  }, [sessionPlayerId, players, adminNotes, events, credentials, passwordResets, dues, collectionAdjustment, rsvps, announcements, registrations, receipts, eventUploads, inventory, procurements, adminView]);

  useEffect(() => {
    if (!loaded.current) return;
    const ensureCurrentMonth = () => {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setDues((current) => {
        const additions = players
          .filter((player) => player.status === 'activo' && player.joinedAt.slice(0, 7) <= month)
          .filter((player) => !current.some((due) => due.playerId === player.id && due.month === month))
          .map((player) => ({ playerId: player.id, month, amount: DUE_AMOUNT, paid: false }));
        return additions.length ? [...current, ...additions] : current;
      });
    };
    ensureCurrentMonth();
    const timer = window.setInterval(ensureCurrentMonth, 60 * 60 * 1000);
    window.addEventListener('focus', ensureCurrentMonth);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', ensureCurrentMonth);
    };
  }, [players]);

  const playerById = (id: string) => players.find((p) => p.id === id);

  const login: StoreState['login'] = (callsignOrName, password) => {
    const q = callsignOrName.trim().toLowerCase();
    if (!q) return 'no-encontrado';
    // Una solicitud pendiente tiene prioridad incluso si está reclamando una
    // ficha ya cargada: el acceso se habilita recién cuando comandancia aprueba.
    if (registrations.some((r) => r.callsign.toLowerCase() === q || r.name.toLowerCase() === q)) {
      return 'pendiente';
    }
    const p = players.find(
      (x) => x.callsign.toLowerCase() === q || x.name.toLowerCase() === q,
    );
    if (!p) return 'no-encontrado';
    if (passwordResets.some((request) => request.playerId === p.id && request.status === 'aprobada')) {
      return 'restablecimiento-aprobado';
    }
    if (credentials[p.id] !== password) return 'clave-incorrecta';
    setSessionPlayerId(p.id);
    return 'ok';
  };

  const value: StoreState = {
    sessionPlayerId,
    login,
    logout: () => setSessionPlayerId(null),
    changePassword: (playerId, currentPassword, newPassword) => {
      if (credentials[playerId] && credentials[playerId] !== currentPassword) {
        return 'clave-incorrecta';
      }
      setCredentials((prev) => ({ ...prev, [playerId]: newPassword }));
      return 'ok';
    },
    passwordResets,
    requestPasswordReset: (callsignOrName) => {
      const q = callsignOrName.trim().toLowerCase();
      const target = players.find(
        (p) => p.callsign.toLowerCase() === q || p.name.toLowerCase() === q || p.nickname?.toLowerCase() === q,
      );
      if (!target) return 'no-encontrado';
      const existing = passwordResets.find((request) => request.playerId === target.id);
      if (existing?.status === 'aprobada') return 'aprobada';
      if (existing) return 'ya-pendiente';
      setPasswordResets((prev) => [
        ...prev,
        { id: uid('reset'), playerId: target.id, requestedAt: today(), status: 'pendiente' },
      ]);
      return 'enviada';
    },
    approvePasswordReset: (id) => {
      const request = passwordResets.find((item) => item.id === id);
      if (!request) return;
      setPasswordResets((prev) =>
        prev.map((item) => (item.id === id ? { ...item, status: 'aprobada' } : item)),
      );
      setCredentials((prev) => {
        const next = { ...prev };
        delete next[request.playerId];
        return next;
      });
    },
    rejectPasswordReset: (id) =>
      setPasswordResets((prev) => prev.filter((request) => request.id !== id)),
    completePasswordReset: (callsignOrName, newPassword) => {
      const q = callsignOrName.trim().toLowerCase();
      const target = players.find(
        (p) => p.callsign.toLowerCase() === q || p.name.toLowerCase() === q || p.nickname?.toLowerCase() === q,
      );
      if (!target) return 'no-encontrado';
      const approved = passwordResets.find(
        (request) => request.playerId === target.id && request.status === 'aprobada',
      );
      if (!approved) return 'no-aprobada';
      setCredentials((prev) => ({ ...prev, [target.id]: newPassword }));
      setPasswordResets((prev) => prev.filter((request) => request.id !== approved.id));
      return 'ok';
    },

    players,
    playerById,
    addPlayer: (p) => setPlayers((prev) => [...prev, p]),
    updatePlayer: (id, patch) =>
      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    removePlayer: (id) => {
      // Una baja conserva la ficha y todo el historial financiero. El integrante
      // queda inactivo y deja de generar cuotas nuevas.
      setPlayers((prev) => prev.map((player) => player.id === id ? { ...player, status: 'inactivo', isAdmin: false } : player));
      setCredentials((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setPasswordResets((prev) => prev.filter((request) => request.playerId !== id));

      if (sessionPlayerId === id) setSessionPlayerId(null);
    },
    events,
    addEvent: (event) => {
      const id = uid('event');
      setEvents((prev) => [...prev, { ...event, id }]);
      return id;
    },
    updateEvent: (id, event) =>
      setEvents((prev) => prev.map((current) => (current.id === id ? { ...event, id } : current))),
    removeEvent: (id) => {
      setEvents((prev) => prev.filter((event) => event.id !== id));
      setRsvps((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEventUploads((prev) => prev.filter((file) => file.eventId !== id));
    },
    adminNotes,
    setAdminNote: (playerId, note) =>
      setAdminNotes((prev) => ({ ...prev, [playerId]: note.trim() })),
    removeAdminNote: (playerId) =>
      setAdminNotes((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      }),

    dues,
    setDuePaid: (playerId, month, paid) =>
      setDues((prev) =>
        prev.map((d) =>
          d.playerId === playerId && d.month === month
            ? { ...d, paid, paidAt: paid ? today() : undefined }
            : d,
        ),
      ),
    collectionAdjustment,
    setCollectionTotal: (total) => {
      const paidFromDues = dues.filter((d) => d.paid).reduce((sum, d) => sum + d.amount, 0);
      setCollectionAdjustment(Math.max(0, Math.round(total)) - paidFromDues);
    },

    rsvps,
    setRsvp: (eventId, playerId, status) =>
      setRsvps((prev) => ({ ...prev, [eventId]: { ...prev[eventId], [playerId]: status } })),

    announcements,
    addAnnouncement: (a) =>
      setAnnouncements((prev) => [{ ...a, id: uid('ann'), date: today() }, ...prev]),
    updateAnnouncement: (id, patch) =>
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    removeAnnouncement: (id) => setAnnouncements((prev) => prev.filter((a) => a.id !== id)),

    registrations,
    submitRegistration: (r) => {
      const normalizedCallsign = r.callsign.trim().toLowerCase();
      if (registrations.some((x) => x.callsign.trim().toLowerCase() === normalizedCallsign)) {
        return 'duplicada';
      }
      const matchedPlayer = players.find(
        (p) => p.callsign.trim().toLowerCase() === normalizedCallsign,
      );
      setRegistrations((prev) => [
        ...prev,
        {
          ...r,
          callsign: r.callsign.trim().toUpperCase(),
          matchedPlayerId: matchedPlayer?.id,
          id: uid('reg'),
          requestedAt: today(),
        },
      ]);
      return 'enviada';
    },
    approveRegistration: (id) => {
      const r = registrations.find((x) => x.id === id);
      if (!r) return;
      // Se vuelve a buscar por callsign al aprobar por si la nómina cambió
      // después de enviada la solicitud. Así nunca se crea un duplicado.
      const existing = players.find(
        (p) => p.id === r.matchedPlayerId || p.callsign.toLowerCase() === r.callsign.toLowerCase(),
      );
      if (existing) {
        setPlayers((prev) =>
          prev.map((p) =>
            p.id === existing.id
              ? { ...p, name: r.name, nickname: r.nickname, phone: r.phone, photoUrl: r.photoUrl }
              : p,
          ),
        );
        setCredentials((prev) => ({ ...prev, [existing.id]: r.password || TEMPORARY_PASSWORD }));
      } else {
        const newId = uid('m');
        setPlayers((prev) => [
          ...prev,
          {
            id: newId,
            callsign: r.callsign.toUpperCase(),
            name: r.name,
            nickname: r.nickname,
            rank: 'Nuevo',
            status: 'activo',
            usualRole: 'Rifleman',
            usualRoles: ['Rifleman'],
            isAdmin: false,
            joinedAt: today(),
            phone: r.phone,
            photoUrl: r.photoUrl,
          },
        ]);
        setCredentials((prev) => ({ ...prev, [newId]: r.password || TEMPORARY_PASSWORD }));
      }
      setRegistrations((prev) => prev.filter((x) => x.id !== id));
    },
    rejectRegistration: (id) => setRegistrations((prev) => prev.filter((x) => x.id !== id)),

    receipts,
    addReceipt: (playerId, month, filename, dataUrl) =>
      setReceipts((prev) => [
        { id: uid('rcpt'), playerId, month, filename, dataUrl, uploadedAt: today(), status: 'revision' },
        ...prev,
      ]),
    acceptReceipt: (id) => {
      const r = receipts.find((x) => x.id === id);
      if (!r) return;
      setReceipts((prev) => prev.map((x) => (x.id === id ? { ...x, status: 'aceptado' } : x)));
      setDues((prev) =>
        prev.map((d) =>
          d.playerId === r.playerId && d.month === r.month
            ? { ...d, paid: true, paidAt: today() }
            : d,
        ),
      );
    },

    eventUploads,
    addEventUpload: (f) => setEventUploads((prev) => [...prev, { ...f, id: uid('ef') }]),
    removeEventUpload: (id) => setEventUploads((prev) => prev.filter((f) => f.id !== id)),

    inventory,
    addInventoryItem: (item) => setInventory((prev) => [...prev, item]),
    updateInventoryItem: (originalName, item) =>
      setInventory((prev) => prev.map((current) => (current.name === originalName ? item : current))),
    removeInventoryItem: (name) =>
      setInventory((prev) => prev.filter((item) => item.name !== name)),
    procurements,
    addProcurement: (item) => setProcurements((prev) => [...prev, item]),
    updateProcurement: (originalItem, item) =>
      setProcurements((prev) => prev.map((current) => (current.item === originalItem ? item : current))),
    removeProcurement: (item) =>
      setProcurements((prev) => prev.filter((current) => current.item !== item)),

    adminView,
    setAdminView,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
}

// Jugador con sesión iniciada. Solo debe usarse en páginas dentro del shell
// autenticado (AppShell no renderiza contenido sin sesión).
export function useCurrentPlayer(): Player {
  const { sessionPlayerId, playerById } = useStore();
  const player = sessionPlayerId ? playerById(sessionPlayerId) : undefined;
  if (!player) {
    // Sesión inválida (p. ej. integrante eliminado): devolver placeholder
    // inofensivo; AppShell redirige a login en el siguiente render.
    return {
      id: '__none__', callsign: '—', name: 'Invitado', rank: 'Nuevo',
      status: 'activo', usualRole: 'Rifleman', usualRoles: ['Rifleman'], isAdmin: false, joinedAt: today(),
    };
  }
  return player;
}
