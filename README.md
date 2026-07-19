# ◈ Gear Locker — Team Six Devgru (TSD)

Hub de operaciones del equipo de airsoft **Team Six Devgru**, enfocado en MILSIM. PWA instalable en desktop y mobile, estética "tactical C2" (portada del design system Lattice de OpenMANET).

## Estado actual: modo demo con datos reales del equipo

`lib/data.ts` carga la nómina TSD, las cuotas 2026 (ene–jul, $10.000/mes) y el inventario desde la planilla `TEAM SIX DEVGRU.xlsx` (hojas "2026", "Inventario" y "Cotizaciones"). Los **eventos siguen siendo de ejemplo** y los roles habituales de cada integrante son provisionales. RSVP y vista admin persisten en `localStorage`:

```bash
npm install
npm run dev
# http://localhost:3000
```

## Secciones

Al abrir la app hay **pantalla de ingreso** con callsign, nickname o nombre y contraseña. En demo, las fichas precargadas usan la clave temporal `TSD2026!`; las cuentas nuevas eligen su contraseña al registrarse. El **registro** exige nombre, callsign, teléfono y contraseña; nickname y foto son opcionales. Si el callsign ya pertenece a una ficha de la nómina, la aprobación vincula la cuenta a esa ficha sin duplicarla; si no existe, crea un integrante nuevo. Cada integrante puede cambiar su contraseña desde el perfil o solicitar a Comandancia un restablecimiento aprobado.

| Ruta | Qué hay |
|---|---|
| `/` (HQ) | Widgets: mi cuota, mi asistencia, mi próximo rol, avisos publicados por comandancia, próximos eventos |
| `/eventos` | Lista con RSVP (voy / tal vez / no voy), link externo, historial de asistencia |
| `/eventos/[id]` | **Briefing Room**: datos de la operación, límites FPS, recordatorios, mapas y archivos, plan de comunicaciones (SOI), ORBAT por squad, roster de confirmados, botón Google Maps |
| `/roster` | Jugadores con foto/avatar, rango, rol habitual, % asistencia y loadout |
| `/cuotas` | Datos bancarios para transferir (con botones Copiar), subir comprobante, historial de pagos |
| `/comandancia` → Inventario | Equipo editable del team, responsables, cantidades, notas y cotizaciones |
| `/comandancia` | Solo admin: publicar avisos al feed, aprobar/rechazar solicitudes de ingreso, revisar comprobantes (aceptar = marca la cuota pagada), agregar/editar/eliminar integrantes, matriz de cuotas clickeable, asistencia, notas privadas, checklist pre-evento |

El botón **"Vista admin"** (abajo en el sidebar) alterna la vista comandancia — en producción esto lo decide `players.is_admin`.

## PWA

- `app/manifest.ts` + `public/sw.js` + íconos en `public/`.
- El service worker se registra solo en producción (`npm run build && npm start`).
- Cachea navegación y assets → los briefings quedan visibles sin señal en cancha.
- En Chrome/Edge aparece "Instalar app"; en iOS: Compartir → Añadir a pantalla de inicio.

## Conectar Supabase (siguiente fase)

1. Ejecutar `supabase/schema.sql` en el SQL Editor del proyecto (crea tablas + RLS con roles jugador/comandancia).
2. Crear buckets de Storage: `event-files` (privado) y `player-photos` (público) — políticas comentadas al final del schema.
3. `npm install @supabase/supabase-js @supabase/ssr` y crear `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Reemplazar la capa demo: `lib/data.ts` define los tipos y helpers — las estructuras calzan 1:1 con las tablas del schema, así que la migración es query por query. `lib/store.tsx` (RSVP + vista admin) se reemplaza por mutaciones a `event_rsvps` y el perfil del usuario autenticado.

## Deploy en Vercel

```bash
# con el repo en GitHub
vercel link
vercel --prod
```
O importar el repo desde el dashboard de Vercel (framework: Next.js, sin config extra). Agregar las env vars de Supabase cuando se conecte la base.

## Roadmap v2 (propuesto)

- Rangos automáticos por asistencia · After Action Reports con fotos y MVP
- Armería/préstamos de equipo del team · SOPs y reglas versionadas
- Pipeline de postulantes · Notificaciones push (recordatorio evento / cuota vencida)
