// =============================================================================
// data.ts — tipos + datos del equipo TEAM SIX DEVGRU (TSD)
// -----------------------------------------------------------------------------
// Nómina, cuotas 2026 e inventario cargados desde la planilla del equipo
// (TEAM SIX DEVGRU.xlsx, hojas "2026", "Inventario" y "Cotizaciones").
// Los eventos son de ejemplo hasta conectar Supabase; las estructuras calzan
// 1:1 con las tablas de supabase/schema.sql.
// =============================================================================

export type Role =
  | 'Squad Leader'
  | 'Team Leader'
  | 'Rifleman'
  | 'LMG'
  | 'Radio Operator'
  | 'DMR'
  | 'Sniper'
  | 'Medic'
  | 'Grenadier'
  | 'Breacher';

export const ROLES: Role[] = [
  'Squad Leader',
  'Team Leader',
  'Rifleman',
  'LMG',
  'Radio Operator',
  'DMR',
  'Sniper',
  'Medic',
  'Grenadier',
  'Breacher',
];

export type Rank = 'Nuevo' | 'Titular' | 'Veterano';
export type MemberStatus = 'activo' | 'receso' | 'inactivo';

export interface Player {
  id: string;
  supaId?: string; // uuid real en public.players — solo si tiene cuenta
  callsign: string; // código TSD (1B9, 12B9, ...)
  name: string;
  nickname?: string;
  rank: Rank;
  status: MemberStatus;
  usualRole: Role; // rol principal, conservado por compatibilidad
  usualRoles?: Role[]; // uno o más roles habituales
  isAdmin: boolean;
  joinedAt: string; // ISO date (aprox. según planillas históricas)
  phone?: string;
  photoUrl?: string;
  loadout?: {
    primary: string;
    secondary?: string;
    fps: number;
    radio?: string;
    camo?: string;
  };
  // Réplicas primarias registradas por el propio integrante, cada una con el
  // rol para el que la usa.
  primaries?: PrimaryWeapon[];
  // Checklist de equipo personal: item -> lo tiene o no. La lista de items la
  // administra comandancia (gearChecklist en el store).
  gear?: Record<string, boolean>;
}

export interface PrimaryWeapon {
  name: string;
  role: Role;
}

// Lista inicial de equipo personal. Comandancia puede agregar o quitar items
// desde la pestaña Equipo; cada integrante marca lo que tiene en Mi perfil.
export const DEFAULT_GEAR_CHECKLIST: string[] = [
  'Protección ocular full-seal',
  'Dead rag',
  'Radio',
  'Chaleco táctico / plate carrier',
  'Casco',
  'Uniforme del equipo',
  'Botiquín personal (IFAK)',
  'Hidratación (camelback)',
  'Baterías de repuesto',
  'Linterna',
];

export interface Due {
  playerId: string;
  month: string; // 'YYYY-MM'
  amount: number; // CLP
  paid: boolean;
  paidAt?: string;
}

export interface CommsChannel {
  channel: string;
  name?: string;
  rxMhz?: string;
  txMhz?: string;
  rxCtcss?: string;
  txCtcss?: string;
  scanAdd?: string;
  busylock?: string;
  wnBand?: string;
  power?: string;
  signalCode?: string;
  // Campos heredados de los briefings iniciales.
  squad?: string;
  freq?: string;
  notes?: string;
}

export const DEFAULT_RADIO_CHANNELS: CommsChannel[] = [
  { channel: 'CH1', name: 'Dev-01', rxMhz: '462,56250', txMhz: '462,56250', rxCtcss: '77.0 Hz', txCtcss: '77.0 Hz', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH2', name: 'Dev-02', rxMhz: '462,58750', txMhz: '462,58750', rxCtcss: '77.0 Hz', txCtcss: '77.0 Hz', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH3', name: 'Dev-03', rxMhz: '462,61250', txMhz: '462,61250', rxCtcss: '100.0 Hz', txCtcss: '100.0 Hz', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH4', name: 'Dev-04', rxMhz: '462,63750', txMhz: '462,63750', rxCtcss: '100.0 Hz', txCtcss: '100.0 Hz', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH5', name: 'Dev-05', rxMhz: '462,66250', txMhz: '462,66250', rxCtcss: '110.9 Hz', txCtcss: '110.9 Hz', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH6', name: 'Dev-06', rxMhz: '462,68750', txMhz: '462,68750', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH7', name: 'Dev-07', rxMhz: '462,71250', txMhz: '462,71250', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH8', name: 'Alt-Externo-01', rxMhz: '462,62500', txMhz: '462,62500', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH9', name: 'Alt-Externo-02', rxMhz: '462,67500', txMhz: '462,67500', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH10', name: 'Alt-Externo-03', rxMhz: '462,55000', txMhz: '462,55000', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH11', name: 'Alt-Externo-04', rxMhz: '462,72500', txMhz: '462,72500', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH12', name: 'Emergencia', rxMhz: '467,63750', txMhz: '467,63750', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
  { channel: 'CH13', name: 'HQ-Comms', rxMhz: 'CAMBIAR según corresponda', txMhz: '467,68750', rxCtcss: 'OFF', txCtcss: 'OFF', scanAdd: 'ON', busylock: 'OFF', wnBand: 'Wide', power: 'High', signalCode: '1' },
];

export interface EventFile {
  id: string;
  name: string;
  kind: 'mapa' | 'documento' | 'imagen';
  size: string;
  url: string;
}

export interface Assignment {
  playerId: string;
  squad: string;
  role: Role;
}

export type RsvpStatus = 'va' | 'no-va' | 'tal-vez';

export interface GameEvent {
  id: string;
  name: string;
  type: 'MILSIM' | 'Combat Mission' | 'Partida Abierta' | 'Partida Cerrada' | 'Entrenamiento';
  date: string;
  startTime: string;
  location: string;
  mapsQuery: string;
  externalLink?: string;
  description: string;
  fpsLimits: { role: string; max: number }[];
  reminders: string[];
  files: EventFile[];
  comms: CommsChannel[];
  assignments: Assignment[];
  attended?: string[]; // ids de asistentes (eventos pasados)
  // Ítems de la checklist de equipo personal que comandancia pide llevar a
  // ESTE evento en particular — independiente de lo que cada uno ya tenga
  // marcado en su perfil.
  requiredGear: string[];
}

export interface InventoryItem {
  name: string;
  qty: number;
  holder: string; // bodega o responsable
  note?: string;
}

export interface Procurement {
  item: string;
  status: 'Pendiente' | 'Evaluando' | 'Hecho';
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warn' | 'crit';
  date: string; // ISO
}

// ---------------------------------------------------------------- pago de cuotas

// Monto de la cuota mensual, en CLP.
export const DUE_AMOUNT = 10000;

// Datos reales de transferencia: viven en variables de entorno (.env.local
// / Vercel), no en el código, porque son datos personales (RUT, correo) que
// no deben quedar en un repositorio público. Los valores de acá abajo son
// solo placeholders que se ven si esas variables no están configuradas.
export const PAYMENT_INFO = {
  holder: process.env.NEXT_PUBLIC_PAYMENT_HOLDER ?? 'Nombre del titular (configurar NEXT_PUBLIC_PAYMENT_HOLDER)',
  rut: process.env.NEXT_PUBLIC_PAYMENT_RUT ?? '00.000.000-0',
  bank: process.env.NEXT_PUBLIC_PAYMENT_BANK ?? 'Nombre del banco',
  accountType: process.env.NEXT_PUBLIC_PAYMENT_ACCOUNT_TYPE ?? 'Tipo de cuenta',
  email: process.env.NEXT_PUBLIC_PAYMENT_EMAIL ?? 'correo@ejemplo.com',
  subject: 'Pago cuota + nombre o número',
  note: 'La cuota no será actualizada hasta recibir el correo con el comprobante.',
};

// ---------------------------------------------------------------- helpers

export function rolesForPlayer(player: Player): Role[] {
  return player.usualRoles?.length ? player.usualRoles : [player.usualRole];
}

// Orden estándar del roster: callsign "<número>B9" de menor a mayor. Los
// callsigns que no calzan con ese patrón quedan al final, en orden alfabético.
export function sortByCallsign<T extends { callsign: string }>(items: T[]): T[] {
  const numOf = (callsign: string) => {
    const match = /^(\d+)B9$/i.exec(callsign.trim());
    return match ? parseInt(match[1], 10) : null;
  };
  return [...items].sort((a, b) => {
    const na = numOf(a.callsign);
    const nb = numOf(b.callsign);
    if (na !== null && nb !== null) return na - nb;
    if (na !== null) return -1;
    if (nb !== null) return 1;
    return a.callsign.localeCompare(b.callsign);
  });
}

// `source` es obligatorio a propósito: estas funciones antes caían por
// defecto en el arreglo de eventos de ejemplo, así que la asistencia y las
// listas se calculaban con datos falsos en vez de los reales de Supabase.
export function upcomingEvents(today: Date, source: GameEvent[]): GameEvent[] {
  return source.filter((e) => new Date(e.date + 'T23:59') >= today).sort(
    (a, b) => a.date.localeCompare(b.date),
  );
}

export function pastEvents(today: Date, source: GameEvent[]): GameEvent[] {
  return source.filter((e) => new Date(e.date + 'T23:59') < today).sort(
    (a, b) => b.date.localeCompare(a.date),
  );
}

export function attendancePct(playerId: string, events: GameEvent[]): number {
  const past = pastEvents(new Date(), events);
  if (past.length === 0) return 0;
  const n = past.filter((e) => e.attended?.includes(playerId)).length;
  return Math.round((n / past.length) * 100);
}

export function fmtMonth(month: string): string {
  const [y, m] = month.split('-');
  const names = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const name = names[parseInt(m, 10) - 1];
  if (!name || !y) return '';
  return `${name} ${y}`;
}

// Acepta tanto 'YYYY-MM-DD' como un timestamp completo de Supabase
// ('YYYY-MM-DDTHH:mm:ss+00:00'), porque según de dónde venga el dato llega
// en uno u otro formato.
export function fmtDate(iso: string): string {
  const dt = new Date(iso.slice(0, 10) + 'T12:00');
  if (Number.isNaN(dt.getTime())) return '';
  const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

// Mes abreviado — para el bloque tipo calendario de los eventos y las
// cabeceras compactas de la tabla de cuotas. Acepta 'YYYY-MM' y 'YYYY-MM-DD'.
export function monthOf(iso: string): string {
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return months[parseInt(iso.slice(5, 7), 10) - 1] ?? '';
}

export function fmtCLP(n: number): string {
  return '$' + n.toLocaleString('es-CL');
}

export function initials(callsign: string): string {
  return callsign.toUpperCase();
}

export function daysUntil(iso: string, today = new Date()): number {
  // Mismo cuidado que fmtDate: tolera timestamps completos de Supabase.
  const target = new Date(iso.slice(0, 10) + 'T12:00');
  if (Number.isNaN(target.getTime())) return 0;
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}
