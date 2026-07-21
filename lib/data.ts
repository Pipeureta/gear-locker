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

export const SEED_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'a1',
    title: 'Inscripciones OP Tormenta del Desierto',
    body: 'Las inscripciones cierran el 31 de julio. Confirma tu asistencia en Eventos y revisa los límites de FPS en el briefing.',
    severity: 'warn',
    date: '2026-07-17',
  },
  {
    id: 'a2',
    title: 'Cuotas al día antes del MILSIM',
    body: 'Recuerda ponerte al día con las cuotas antes del evento de agosto. Los datos de transferencia están en la sección Cuotas.',
    severity: 'info',
    date: '2026-07-12',
  },
];

// ---------------------------------------------------------------- integrantes

// Nombres genéricos a propósito: la identidad real de cada integrante vive
// en Supabase (players.name, vinculada a su cuenta) desde que se registra y
// comandancia aprueba su solicitud. Este arreglo es solo el "puente" local
// para todo lo que aún no está migrado (cuotas, eventos, roster de otros
// integrantes) — no debe llevar datos personales reales en un repo público.
export const PLAYERS: Player[] = [
  { id: '1b9', callsign: '1B9', name: 'Integrante 1B9', rank: 'Veterano', status: 'activo', usualRole: 'Squad Leader', isAdmin: true, joinedAt: '2021-02-01' },
  { id: '2b9', callsign: '2B9', name: 'Integrante 2B9', rank: 'Titular', status: 'activo', usualRole: 'LMG', isAdmin: false, joinedAt: '2024-02-01' },
  { id: '3b9', callsign: '3B9', name: 'Integrante 3B9', rank: 'Veterano', status: 'activo', usualRole: 'Sniper', isAdmin: false, joinedAt: '2021-02-01' },
  { id: '4b9', callsign: '4B9', name: 'Integrante 4B9', rank: 'Veterano', status: 'activo', usualRole: 'Rifleman', isAdmin: false, joinedAt: '2021-02-01' },
  { id: '5b9', callsign: '5B9', name: 'Integrante 5B9', rank: 'Veterano', status: 'activo', usualRole: 'Radio Operator', isAdmin: false, joinedAt: '2021-02-01' },
  { id: '6b9', callsign: '6B9', name: 'Integrante 6B9', rank: 'Veterano', status: 'receso', usualRole: 'Rifleman', isAdmin: false, joinedAt: '2021-02-01' },
  { id: '7b9', callsign: '7B9', name: 'Integrante 7B9', rank: 'Veterano', status: 'activo', usualRole: 'DMR', isAdmin: false, joinedAt: '2021-02-01' },
  { id: '8b9', callsign: '8B9', name: 'Integrante 8B9', rank: 'Titular', status: 'activo', usualRole: 'Medic', isAdmin: false, joinedAt: '2022-01-01' },
  { id: '9b9', callsign: '9B9', name: 'Integrante 9B9', rank: 'Titular', status: 'activo', usualRole: 'Grenadier', isAdmin: false, joinedAt: '2023-09-01' },
  { id: '10b9', callsign: '10B9', name: 'Integrante 10B9', rank: 'Veterano', status: 'activo', usualRole: 'Team Leader', isAdmin: false, joinedAt: '2021-02-01' },
  { id: '12b9', callsign: '12B9', name: 'Integrante 12B9', rank: 'Titular', status: 'activo', usualRole: 'Squad Leader', isAdmin: true, joinedAt: '2024-01-01' },
  { id: '13b9', callsign: '13B9', name: 'Integrante 13B9', rank: 'Nuevo', status: 'activo', usualRole: 'Rifleman', isAdmin: false, joinedAt: '2026-01-01' },
  { id: '14b9', callsign: '14B9', name: 'Integrante 14B9', rank: 'Nuevo', status: 'activo', usualRole: 'Rifleman', isAdmin: false, joinedAt: '2026-04-01' },
];

// Usuario actual en modo demo
export const CURRENT_PLAYER_ID = '12b9';

// ---------------------------------------------------------------- cuotas 2026

// Cuota mensual $10.000 (hoja PROGRAMACION). Estado enero–julio según hoja
// "2026": pagada / pendiente; los meses en receso no generan cuota.
export const DUE_AMOUNT = 10000;

export const DUE_MONTHS = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];

// Por integrante: hasta qué mes pagó y desde qué mes le corre cuota.
// [id, primer mes con cuota (índice 0-6), meses pagados (índices)]
const DUES_2026: Record<string, { from: number; paid: number[] }> = {
  '1b9': { from: 0, paid: [0, 1, 2, 3] },       // ene–abr pagadas
  '2b9': { from: 0, paid: [0, 1, 2, 3, 4, 5] }, // ene–jun pagadas
  '3b9': { from: 0, paid: [0, 1] },             // ene–feb pagadas
  '4b9': { from: 3, paid: [] },                 // cuota corre desde abr
  '5b9': { from: 0, paid: [0, 1, 2, 3] },
  // 6b9: receso — sin cuotas
  '7b9': { from: 3, paid: [3, 4] },             // abr–may pagadas
  '8b9': { from: 0, paid: [0, 1, 2] },
  '9b9': { from: 0, paid: [0, 1, 2] },
  '10b9': { from: 3, paid: [] },
  '12b9': { from: 0, paid: [0, 1, 2, 3, 4, 5] },
  '13b9': { from: 0, paid: [0, 1, 2, 3] },
  '14b9': { from: 3, paid: [3, 4, 5] },         // nuevo desde abril
};

export const DUES: Due[] = Object.entries(DUES_2026).flatMap(([playerId, cfg]) =>
  DUE_MONTHS.slice(cfg.from).map((month) => {
    const idx = DUE_MONTHS.indexOf(month);
    const paid = cfg.paid.includes(idx);
    return {
      playerId,
      month,
      amount: DUE_AMOUNT,
      paid,
      paidAt: paid ? `${month}-05` : undefined,
    };
  }),
);

// ---------------------------------------------------------------- eventos (demo)

export const EVENTS: GameEvent[] = [
  {
    id: 'e-milsim-atacama',
    name: 'OP TORMENTA DEL DESIERTO',
    type: 'MILSIM',
    date: '2026-08-09',
    startTime: '08:00',
    location: 'Fundo Los Maitenes, Til Til',
    mapsQuery: 'Til Til, Región Metropolitana, Chile',
    externalLink: 'https://www.instagram.com/',
    description:
      'MILSIM de 12 horas, dos facciones, objetivos dinámicos con FOB y sistema de respawn por oleadas. Se exige uniforme por facción y radio por escuadra.',
    fpsLimits: [
      { role: 'Fusil / SMG', max: 350 },
      { role: 'DMR (semi)', max: 400 },
      { role: 'Sniper (cerrojo)', max: 450 },
      { role: 'LMG', max: 350 },
    ],
    reminders: [
      'Llevar 2 baterías cargadas mínimo',
      'Chrono obligatorio 08:15 — sin chrono no juegas',
      'Hidratación: mínimo 3L por persona',
      'Dead rag y protección ocular full-seal obligatorios',
    ],
    files: [],
    comms: [
      { squad: 'Comando', channel: 'CH 1', freq: '446.006 MHz', notes: 'Solo SL/TL' },
      { squad: 'Alpha', channel: 'CH 3', freq: '446.031 MHz' },
      { squad: 'Bravo', channel: 'CH 5', freq: '446.056 MHz' },
      { squad: 'Emergencia', channel: 'CH 8', freq: '446.093 MHz', notes: 'Solo emergencias reales' },
    ],
    assignments: [
      { playerId: '12b9', squad: 'Alpha', role: 'Squad Leader' },
      { playerId: '5b9', squad: 'Alpha', role: 'Radio Operator' },
      { playerId: '2b9', squad: 'Alpha', role: 'LMG' },
      { playerId: '13b9', squad: 'Alpha', role: 'Rifleman' },
      { playerId: '1b9', squad: 'Bravo', role: 'Squad Leader' },
      { playerId: '8b9', squad: 'Bravo', role: 'Medic' },
      { playerId: '9b9', squad: 'Bravo', role: 'Grenadier' },
      { playerId: '14b9', squad: 'Bravo', role: 'Rifleman' },
      { playerId: '3b9', squad: 'Recon', role: 'Sniper' },
      { playerId: '7b9', squad: 'Recon', role: 'DMR' },
    ],
  },
  {
    id: 'e-skirmish-jul',
    name: 'PARTIDA ABIERTA DOMINICAL',
    type: 'Partida Abierta',
    date: '2026-07-26',
    startTime: '09:30',
    location: 'Cancha CQB La Reina',
    mapsQuery: 'La Reina, Santiago, Chile',
    description:
      'Partida abierta de domingo: modos rápidos (dominación, VIP, bomba). Ideal para probar loadouts antes del MILSIM de agosto.',
    fpsLimits: [
      { role: 'Fusil / SMG', max: 350 },
      { role: 'Pistola', max: 330 },
    ],
    reminders: ['Llegar 09:00 para chrono', 'Cancha techada — no se suspende por lluvia'],
    files: [],
    comms: [{ squad: 'General', channel: 'CH 2', freq: '446.018 MHz' }],
    assignments: [],
  },
  {
    id: 'e-entrenamiento-ago',
    name: 'ENTRENAMIENTO: CQB + RADIO',
    type: 'Entrenamiento',
    date: '2026-08-23',
    startTime: '10:00',
    location: 'Recinto Peñalolén',
    mapsQuery: 'Peñalolén, Santiago, Chile',
    description:
      'Instrucción interna: despeje de habitaciones en parejas, procedimientos de radio (formato SALUTE, 9-line simplificado) y señales de mano.',
    fpsLimits: [{ role: 'Fusil / SMG', max: 350 }],
    reminders: ['Traer cuaderno para procedimientos de radio'],
    files: [],
    comms: [],
    assignments: [],
  },
  // Sin eventos pasados de ejemplo: comandancia carga los reales desde
  // Comandancia → Eventos y marca la asistencia real de cada uno ahí mismo.
];

// ---------------------------------------------------------------- notas comandancia

// Notas de ejemplo — las notas reales de comandancia se escriben desde la
// app (Comandancia → ficha del integrante) y no deben quedar commiteadas en
// un repo público, ya que suelen incluir información privada o financiera.
export const ADMIN_NOTES: Record<string, string> = {};

// ---------------------------------------------------------------- inventario

// Hoja "Inventario" de la planilla. Los responsables se dejan como "Bodega"
// por defecto para no versionar a qué integrante específico se le prestó
// cada artículo — eso se administra desde la app.
export const INVENTORY: InventoryItem[] = [
  { name: 'Mesa plegable 1.8 mts', qty: 1, holder: 'Bodega' },
  { name: 'Caja plástica para cachureos', qty: 2, holder: 'Bodega' },
  { name: 'Malla camuflada grande', qty: 1, holder: 'Bodega' },
  { name: 'Malla camuflada pequeña', qty: 1, holder: '—' },
  { name: 'Estufita de camping', qty: 1, holder: 'Bodega' },
  { name: 'Gas estufa chico', qty: 4, holder: 'Bodega', note: '1 en bodega' },
  { name: 'Carpa', qty: 1, holder: 'Bodega' },
  { name: 'Cooler Coleman', qty: 1, holder: 'Bodega' },
  { name: 'Parrilla armable', qty: 1, holder: 'Bodega' },
  { name: 'Dron DJI Mavic Mini 2', qty: 1, holder: 'Bodega' },
  { name: 'Baterías dron', qty: 4, holder: 'Bodega' },
  { name: 'Cargador de baterías DJI', qty: 1, holder: 'Bodega' },
  { name: 'Generador Hyundai', qty: 1, holder: 'Bodega' },
  { name: 'Estación de radio Anytone', qty: 1, holder: 'Bodega' },
  { name: 'Estuche DJI', qty: 1, holder: 'Bodega', note: 'De baja — se cambia por maleta' },
  { name: 'Data (proyector)', qty: 1, holder: 'Bodega' },
  { name: 'Alargador', qty: 1, holder: 'Bodega' },
  { name: 'Confort', qty: 6, holder: 'Bodega' },
  { name: 'Luces y powerbank', qty: 1, holder: 'Bodega' },
  { name: 'Cajas plegables bravo', qty: 8, holder: 'Bodega' },
  { name: 'Carrito plegable', qty: 1, holder: 'Bodega' },
  { name: 'Trípode amarillo', qty: 1, holder: 'Bodega' },
  { name: 'Antena Sirius', qty: 1, holder: 'Bodega' },
  { name: 'Tela proyector', qty: 1, holder: 'Bodega' },
  { name: 'Mochila', qty: 1, holder: 'Bodega' },
];

// Hoja "Cotizaciones".
export const PROCUREMENTS: Procurement[] = [
  { item: 'Bandera del team con logo Anubis', status: 'Pendiente' },
  { item: 'Malla de camuflaje', status: 'Hecho' },
  { item: 'Tienda de campaña para 10 personas', status: 'Evaluando' },
];

// ---------------------------------------------------------------- helpers

export function rolesForPlayer(player: Player): Role[] {
  return player.usualRoles?.length ? player.usualRoles : [player.usualRole];
}

export function playerById(id: string): Player | undefined {
  return PLAYERS.find((p) => p.id === id);
}

export function activePlayers(): Player[] {
  return PLAYERS.filter((p) => p.status === 'activo');
}

export function upcomingEvents(today = new Date(), source: GameEvent[] = EVENTS): GameEvent[] {
  return source.filter((e) => new Date(e.date + 'T23:59') >= today).sort(
    (a, b) => a.date.localeCompare(b.date),
  );
}

export function pastEvents(today = new Date(), source: GameEvent[] = EVENTS): GameEvent[] {
  return source.filter((e) => new Date(e.date + 'T23:59') < today).sort(
    (a, b) => b.date.localeCompare(a.date),
  );
}

export function eventById(id: string): GameEvent | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function duesForPlayer(playerId: string): Due[] {
  return DUES.filter((x) => x.playerId === playerId);
}

export function pendingDues(playerId: string): Due[] {
  return duesForPlayer(playerId).filter((x) => !x.paid);
}

export function attendancePct(playerId: string): number {
  const past = pastEvents();
  if (past.length === 0) return 0;
  const n = past.filter((e) => e.attended?.includes(playerId)).length;
  return Math.round((n / past.length) * 100);
}

export function fmtMonth(month: string): string {
  const [y, m] = month.split('-');
  const names = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
}

export function fmtDate(iso: string): string {
  const dt = new Date(iso + 'T12:00');
  const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function fmtCLP(n: number): string {
  return '$' + n.toLocaleString('es-CL');
}

export function initials(callsign: string): string {
  return callsign.toUpperCase();
}

export function daysUntil(iso: string, today = new Date()): number {
  const target = new Date(iso + 'T12:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}
