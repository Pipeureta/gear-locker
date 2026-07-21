'use client';

// Estado de cliente para cuotas, eventos, inventario, avisos, etc. La
// identidad del usuario (login, registro, aprobación) vive en
// lib/auth-context.tsx y es real (Supabase Auth + tabla players). Todo lo
// demás en este archivo sigue en localStorage por ahora — se migra a
// Supabase en una fase siguiente; las estructuras ya calzan 1:1 con
// supabase/schema.sql para cuando llegue ese momento.

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
  type Rank,
  type MemberStatus,
  type Role,
  type RsvpStatus,
} from './data';
import { useAuth, type SupaPlayerRow } from './auth-context';
import { createClient } from './supabase/client';

export interface Receipt {
  id: string;
  playerId: string;
  month: string; // 'YYYY-MM'
  filename: string;
  dataUrl: string;
  uploadedAt: string;
  status: 'revision' | 'aceptado';
}

export interface UploadedEventFile {
  id: string;
  eventId: string;
  name: string;
  kind: 'mapa' | 'documento' | 'imagen';
  // Ruta dentro del bucket privado 'event-files' de Supabase Storage — no
  // es una URL directa, hay que pedir una firmada para ver/descargar.
  storagePath: string;
  size: string;
  uploadedAt: string; // ISO date — para distinguir intel "durante/después" del evento
}

interface StoreState {
  players: Player[];
  playerById: (id: string) => Player | undefined;
  addPlayer: (p: Player) => void;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  removePlayer: (id: string) => void;
  deletePlayer: (id: string) => void;

  events: GameEvent[];
  addEvent: (event: Omit<GameEvent, 'id'>) => string;
  updateEvent: (id: string, event: Omit<GameEvent, 'id'>) => void;
  removeEvent: (id: string) => void;
  setEventAttended: (eventId: string, playerId: string, attended: boolean) => void;
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

const LS_KEY = 'gear-locker-tsd-v4'; // versionado: invalida estados de versiones anteriores (v3 tenía login simulado)

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [players, setPlayers] = useState<Player[]>(PLAYERS);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>(ADMIN_NOTES);
  const [events, setEvents] = useState<GameEvent[]>(EVENTS);
  const [dues, setDues] = useState<Due[]>(DUES);
  // Ajuste manual sobre la suma de cuotas pagadas. Permite que comandancia
  // concilie el total real sin perder la actualización automática por cuotas.
  const [collectionAdjustment, setCollectionAdjustment] = useState(0);
  const [rsvps, setRsvps] = useState(DEFAULT_RSVPS);
  const [announcements, setAnnouncements] = useState<Announcement[]>(SEED_ANNOUNCEMENTS);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [eventUploads, setEventUploads] = useState<UploadedEventFile[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>(INVENTORY);
  const [procurements, setProcurements] = useState<Procurement[]>(PROCUREMENTS);
  const loaded = useRef(false);

  // El arreglo local (lib/data.ts) solo trae callsigns y datos de ejemplo —
  // a propósito, porque ese archivo está en el repo público. Los datos
  // reales de cada integrante (nombre, foto, rol, etc.) viven en Supabase;
  // acá se traen y se sobreponen sobre el arreglo local por callsign, así
  // el roster, las cuotas y los eventos muestran a la gente real.
  useEffect(() => {
    if (!session) return;
    const supabase = createClient();
    supabase
      .from('players')
      .select('*')
      .then(({ data, error }) => {
        if (error || !data) return;
        const remoteRows = data as SupaPlayerRow[];
        const remoteIds = new Set(remoteRows.map((r) => `sb-${r.id}`));
        setPlayers((prev) => {
          // Se quitan las fichas "sb-" que ya no existen en Supabase (p.ej.
          // eliminadas desde Comandancia) — si no, quedaban pegadas en el
          // estado local para siempre.
          const next = prev.filter((p) => !p.id.startsWith('sb-') || remoteIds.has(p.id));
          remoteRows.forEach((remote) => {
            const idx = next.findIndex((p) => p.callsign.toLowerCase() === remote.callsign.toLowerCase());
            if (idx >= 0) {
              next[idx] = fromSupaPlayer(remote, next[idx].id);
            } else {
              next.push(fromSupaPlayer(remote, `sb-${remote.id}`));
            }
          });
          return next;
        });
      });
  }, [session]);

  useEffect(() => {
    const apply = (raw: string | null) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        // players NO se cachea: siempre viene fresco de Supabase (ver el
        // efecto de más abajo). Cachearlo hacía que integrantes editados
        // o eliminados en Supabase reaparecieran con datos viejos.
        if (s.adminNotes) setAdminNotes(s.adminNotes);
        if (s.events) setEvents(s.events);
        if (s.dues) setDues(s.dues);
        if (typeof s.collectionAdjustment === 'number') setCollectionAdjustment(s.collectionAdjustment);
        if (s.rsvps) setRsvps(s.rsvps);
        if (s.announcements) setAnnouncements(s.announcements);
        if (s.receipts) setReceipts(s.receipts);
        if (s.eventUploads) setEventUploads(s.eventUploads);
        if (s.inventory) setInventory(s.inventory);
        if (s.procurements) setProcurements(s.procurements);
      } catch {
        /* estado corrupto — se ignora */
      }
    };

    apply(localStorage.getItem(LS_KEY));
    loaded.current = true;

    // Sincronización en vivo entre pestañas/ventanas del mismo navegador:
    // cualquier cambio hecho en otra pestaña se refleja aquí sin recargar.
    // (Entre dispositivos distintos, esto lo hará Supabase Realtime.)
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) apply(e.newValue);
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
          adminNotes, events, dues, collectionAdjustment,
          rsvps, announcements, receipts, eventUploads, inventory,
          procurements,
        }),
      );
    } catch {
      /* cuota de localStorage excedida — el estado sigue en memoria */
    }
  }, [adminNotes, events, dues, collectionAdjustment, rsvps, announcements, receipts, eventUploads, inventory, procurements]);

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

  const value: StoreState = {
    players,
    playerById,
    addPlayer: (p) => setPlayers((prev) => [...prev, p]),
    updatePlayer: (id, patch) =>
      setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    deletePlayer: (id) => setPlayers((prev) => prev.filter((p) => p.id !== id)),
    removePlayer: (id) => {
      // Una baja conserva la ficha y todo el historial financiero. El integrante
      // queda inactivo y deja de generar cuotas nuevas.
      setPlayers((prev) =>
        prev.map((player) => (player.id === id ? { ...player, status: 'inactivo', isAdmin: false } : player)),
      );
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
    setEventAttended: (eventId, playerId, attended) =>
      setEvents((prev) =>
        prev.map((event) => {
          if (event.id !== eventId) return event;
          const current = new Set(event.attended ?? []);
          if (attended) current.add(playerId);
          else current.delete(playerId);
          return { ...event, attended: [...current] };
        }),
      ),
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
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore(): StoreState {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore debe usarse dentro de StoreProvider');
  return ctx;
}

function fromSupaPlayer(row: SupaPlayerRow, localId: string): Player {
  return {
    id: localId,
    callsign: row.callsign,
    name: row.name,
    nickname: row.nickname ?? undefined,
    rank: row.rank as Rank,
    status: row.status as MemberStatus,
    usualRole: (row.usual_roles?.[0] as Role | undefined) ?? (row.usual_role as Role) ?? 'Rifleman',
    usualRoles: (row.usual_roles as Role[] | null) ?? undefined,
    isAdmin: row.is_admin,
    joinedAt: row.joined_at,
    phone: row.phone ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    primaries: row.primaries ?? undefined,
    gear: row.gear ?? undefined,
  };
}

// Jugador con sesión iniciada. La identidad (nombre, callsign, foto, admin,
// primarias, equipo) viene de Supabase Auth — fuente real. El resto de la
// app (cuotas, eventos, notas) todavía vive en el store local, así que acá
// se "calza" la ficha real con la ficha local que comparte callsign (o se
// crea una si es alguien nuevo que no estaba en la nómina de ejemplo).
export function useCurrentPlayer(): Player {
  const { supaPlayer } = useAuth();
  const { players, addPlayer } = useStore();

  const localMatch = supaPlayer
    ? players.find((p) => p.callsign.toLowerCase() === supaPlayer.callsign.toLowerCase())
    : undefined;
  const localId = localMatch?.id ?? (supaPlayer ? `sb-${supaPlayer.id}` : '__none__');

  useEffect(() => {
    if (supaPlayer && !localMatch) {
      addPlayer(fromSupaPlayer(supaPlayer, `sb-${supaPlayer.id}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supaPlayer?.id, !!localMatch]);

  if (!supaPlayer) {
    return {
      id: '__none__', callsign: '—', name: 'Invitado', rank: 'Nuevo',
      status: 'activo', usualRole: 'Rifleman', usualRoles: ['Rifleman'], isAdmin: false, joinedAt: today(),
    };
  }

  const merged = fromSupaPlayer(supaPlayer, localId);
  // Conserva del registro local lo que Supabase todavía no gestiona
  // (por ahora nada crítico — se deja el bloque por si se agregan campos
  // locales-only más adelante).
  return localMatch ? { ...localMatch, ...merged } : merged;
}
