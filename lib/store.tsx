'use client';

// Estado de cliente para la app. La identidad del usuario (login, registro,
// aprobación) vive en lib/auth-context.tsx. Todo lo demás (roster, eventos,
// cuotas, comprobantes, notas, inventario, cotizaciones, avisos) vive en
// Supabase — nada queda solo en el teléfono, salvo datos de ejemplo antes
// de iniciar sesión.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  DUE_AMOUNT,
  PLAYERS,
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
import {
  addFileRemote,
  createEventRemote,
  deleteEventRemote,
  fetchEventData,
  removeFileRemote,
  setAttendanceRemote,
  setRsvpRemote,
  updateEventRemote,
} from './supabase/events';
import {
  acceptReceiptRemote,
  fetchCollectionAdjustment,
  fetchDues,
  fetchReceipts,
  insertDuesRemote,
  setCollectionAdjustmentRemote,
  setDuePaidRemote,
  uploadReceiptRemote,
} from './supabase/finance';
import {
  addAnnouncementRemote,
  addInventoryItemRemote,
  addProcurementRemote,
  fetchAdminNotes,
  fetchAnnouncements,
  fetchInventory,
  fetchProcurements,
  removeAdminNoteRemote,
  removeAnnouncementRemote,
  removeInventoryItemRemote,
  removeProcurementRemote,
  setAdminNoteRemote,
  updateAnnouncementRemote,
  updateInventoryItemRemote,
  updateProcurementRemote,
} from './supabase/team-data';

export interface Receipt {
  id: string;
  playerId: string;
  month: string; // 'YYYY-MM'
  filename: string;
  // Ruta en el bucket privado 'receipts' — hay que pedir una URL firmada
  // para verlo/descargarlo (ver lib/supabase/finance.ts).
  storagePath: string;
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
  addReceipt: (playerId: string, month: string, file: File) => Promise<{ error: string | null }>;
  acceptReceipt: (id: string) => void;

  eventUploads: UploadedEventFile[];
  addEventUpload: (f: Omit<UploadedEventFile, 'id'> & { sizeBytes: number }) => void;
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

const StoreCtx = createContext<StoreState | null>(null);

let seq = 0;
function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { session, supaPlayer } = useAuth();
  const [players, setPlayers] = useState<Player[]>(PLAYERS);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [dues, setDues] = useState<Due[]>([]);
  // Ajuste manual sobre la suma de cuotas pagadas. Permite que comandancia
  // concilie el total real sin perder la actualización automática por cuotas.
  const [collectionAdjustment, setCollectionAdjustment] = useState(0);
  const [rsvps, setRsvps] = useState<Record<string, Record<string, RsvpStatus>>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [eventUploads, setEventUploads] = useState<UploadedEventFile[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [procurements, setProcurements] = useState<Procurement[]>([]);

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
      .then(async ({ data, error }) => {
        if (error || !data) return;
        const remoteRows = data as SupaPlayerRow[];
        const remoteSupaIds = new Set(remoteRows.map((r) => r.id));
        let merged: Player[] = [];
        setPlayers((prev) => {
          // Se quitan las fichas que tenían cuenta real (supaId) y ya no
          // existen en Supabase (p.ej. eliminadas desde Comandancia) — antes
          // esto solo miraba el prefijo "sb-" del id local, que no cubre a
          // los integrantes que "reclamaron" una ficha semilla ya existente
          // (conservan su id local original, no uno "sb-").
          const next = prev.filter((p) => !p.supaId || remoteSupaIds.has(p.supaId));
          remoteRows.forEach((remote) => {
            const idx = next.findIndex((p) => p.callsign.toLowerCase() === remote.callsign.toLowerCase());
            if (idx >= 0) {
              next[idx] = fromSupaPlayer(remote, next[idx].id);
            } else {
              next.push(fromSupaPlayer(remote, `sb-${remote.id}`));
            }
          });
          merged = next;
          return next;
        });

        // Eventos, RSVPs, archivos, cuotas, comprobantes, notas, avisos,
        // inventario y cotizaciones viven en Supabase — nada de esto
        // desaparece si se borran los datos del sitio o se cambia de
        // dispositivo.
        const [
          eventData,
          remoteDues,
          remoteReceipts,
          remoteNotes,
          remoteAnnouncements,
          remoteInventory,
          remoteProcurements,
          remoteAdjustment,
        ] = await Promise.all([
          fetchEventData(merged),
          fetchDues(merged),
          fetchReceipts(merged),
          fetchAdminNotes(merged),
          fetchAnnouncements(),
          fetchInventory(),
          fetchProcurements(),
          fetchCollectionAdjustment(),
        ]);
        setEvents(eventData.events);
        setRsvps(eventData.rsvps);
        setEventUploads(eventData.uploads);
        setDues(remoteDues);
        setReceipts(remoteReceipts);
        setAdminNotes(remoteNotes);
        setAnnouncements(remoteAnnouncements);
        setInventory(remoteInventory);
        setProcurements(remoteProcurements);
        setCollectionAdjustment(remoteAdjustment);
      });
  }, [session]);

  // Genera la cuota del mes en curso para cada integrante activo que aún no
  // la tenga. Solo el admin puede insertar filas en "dues" (RLS), así que
  // esto se hace en silencio cuando quien tiene la sesión abierta es
  // comandancia — no bloquea a los demás, solo no genera la fila hasta que
  // algún admin entre a la app ese mes.
  useEffect(() => {
    if (!session || !supaPlayer?.is_admin) return;
    const ensureCurrentMonth = () => {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setDues((current) => {
        const additions = players
          .filter((player) => player.status === 'activo' && player.joinedAt.slice(0, 7) <= month)
          .filter((player) => !current.some((due) => due.playerId === player.id && due.month === month))
          .map((player) => ({ playerId: player.id, month, amount: DUE_AMOUNT, paid: false }));
        if (additions.length) {
          insertDuesRemote(
            additions
              .map((a) => ({ playerSupaId: players.find((p) => p.id === a.playerId)?.supaId, month, amount: DUE_AMOUNT }))
              .filter((r): r is { playerSupaId: string; month: string; amount: number } => Boolean(r.playerSupaId)),
          );
        }
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
  }, [session, supaPlayer?.is_admin, players]);

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
      const supaId = players.find((p) => p.id === id)?.supaId;
      if (supaId) {
        createClient().from('players').update({ status: 'receso', is_admin: false }).eq('id', supaId);
      }
    },
    events,
    addEvent: (event) => {
      const tempId = uid('event');
      createEventRemote(event, players).then((realId) => {
        if (realId) setEvents((prev) => [...prev, { ...event, id: realId }]);
        else alert('No se pudo guardar el evento en la base de datos. Intenta de nuevo.');
      });
      return tempId;
    },
    updateEvent: (id, event) => {
      setEvents((prev) => prev.map((current) => (current.id === id ? { ...event, id } : current)));
      updateEventRemote(id, event, players);
    },
    removeEvent: (id) => {
      setEvents((prev) => prev.filter((event) => event.id !== id));
      setRsvps((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setEventUploads((prev) => prev.filter((file) => file.eventId !== id));
      deleteEventRemote(id);
    },
    setEventAttended: (eventId, playerId, attended) => {
      setEvents((prev) =>
        prev.map((event) => {
          if (event.id !== eventId) return event;
          const current = new Set(event.attended ?? []);
          if (attended) current.add(playerId);
          else current.delete(playerId);
          return { ...event, attended: [...current] };
        }),
      );
      const supaId = players.find((p) => p.id === playerId)?.supaId;
      if (supaId) setAttendanceRemote(eventId, supaId, attended);
    },
    adminNotes,
    setAdminNote: (playerId, note) => {
      const trimmed = note.trim();
      setAdminNotes((prev) => ({ ...prev, [playerId]: trimmed }));
      const supaId = players.find((p) => p.id === playerId)?.supaId;
      if (supaId) setAdminNoteRemote(supaId, trimmed);
    },
    removeAdminNote: (playerId) => {
      setAdminNotes((prev) => {
        const next = { ...prev };
        delete next[playerId];
        return next;
      });
      const supaId = players.find((p) => p.id === playerId)?.supaId;
      if (supaId) removeAdminNoteRemote(supaId);
    },

    dues,
    setDuePaid: (playerId, month, paid) => {
      setDues((prev) =>
        prev.map((d) =>
          d.playerId === playerId && d.month === month
            ? { ...d, paid, paidAt: paid ? today() : undefined }
            : d,
        ),
      );
      const supaId = players.find((p) => p.id === playerId)?.supaId;
      if (supaId) setDuePaidRemote(supaId, month, paid);
    },
    collectionAdjustment,
    setCollectionTotal: (total) => {
      const paidFromDues = dues.filter((d) => d.paid).reduce((sum, d) => sum + d.amount, 0);
      const adjustment = Math.max(0, Math.round(total)) - paidFromDues;
      setCollectionAdjustment(adjustment);
      setCollectionAdjustmentRemote(adjustment);
    },

    rsvps,
    setRsvp: (eventId, playerId, status) => {
      setRsvps((prev) => ({ ...prev, [eventId]: { ...prev[eventId], [playerId]: status } }));
      const supaId = players.find((p) => p.id === playerId)?.supaId;
      if (supaId) setRsvpRemote(eventId, supaId, status);
    },

    announcements,
    addAnnouncement: (a) => {
      addAnnouncementRemote(a).then((created) => {
        if (created) setAnnouncements((prev) => [created, ...prev]);
        else alert('No se pudo guardar el aviso. Intenta de nuevo.');
      });
    },
    updateAnnouncement: (id, patch) => {
      setAnnouncements((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      updateAnnouncementRemote(id, patch);
    },
    removeAnnouncement: (id) => {
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      removeAnnouncementRemote(id);
    },

    receipts,
    addReceipt: async (playerId, month, file) => {
      const supaId = players.find((p) => p.id === playerId)?.supaId;
      if (!supaId || !session) return { error: 'No se pudo identificar tu cuenta. Vuelve a iniciar sesión.' };
      try {
        const result = await uploadReceiptRemote(session.user.id, supaId, month, file);
        if (!result) return { error: 'No se pudo guardar el comprobante.' };
        setReceipts((prev) => [
          { id: result.id, playerId, month, filename: file.name, storagePath: result.storagePath, uploadedAt: result.uploadedAt, status: 'revision' },
          ...prev,
        ]);
        return { error: null };
      } catch (err) {
        return { error: err instanceof Error ? err.message : 'No se pudo subir el archivo.' };
      }
    },
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
      const supaId = players.find((p) => p.id === r.playerId)?.supaId;
      if (supaId) acceptReceiptRemote(id, supaId, r.month);
    },

    eventUploads,
    addEventUpload: (f) => {
      const { sizeBytes, ...meta } = f;
      addFileRemote(f.eventId, { name: f.name, kind: f.kind, storagePath: f.storagePath, sizeBytes }).then((res) => {
        if (res) setEventUploads((prev) => [...prev, { ...meta, id: res.id, uploadedAt: res.uploadedAt }]);
        else alert('No se pudo guardar el archivo en la base de datos. Intenta de nuevo.');
      });
    },
    removeEventUpload: (id) => {
      setEventUploads((prev) => prev.filter((f) => f.id !== id));
      removeFileRemote(id);
    },

    inventory,
    addInventoryItem: (item) => {
      setInventory((prev) => [...prev, item]);
      addInventoryItemRemote(item);
    },
    updateInventoryItem: (originalName, item) => {
      setInventory((prev) => prev.map((current) => (current.name === originalName ? item : current)));
      updateInventoryItemRemote(originalName, item);
    },
    removeInventoryItem: (name) => {
      setInventory((prev) => prev.filter((item) => item.name !== name));
      removeInventoryItemRemote(name);
    },
    procurements,
    addProcurement: (item) => {
      setProcurements((prev) => [...prev, item]);
      addProcurementRemote(item);
    },
    updateProcurement: (originalItem, item) => {
      setProcurements((prev) => prev.map((current) => (current.item === originalItem ? item : current)));
      updateProcurementRemote(originalItem, item);
    },
    removeProcurement: (item) => {
      setProcurements((prev) => prev.filter((current) => current.item !== item));
      removeProcurementRemote(item);
    },
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
    supaId: row.id,
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
