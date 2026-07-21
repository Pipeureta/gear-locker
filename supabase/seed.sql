-- =============================================================================
-- Gear Locker — datos semilla (SOLO para el setup inicial de una base nueva)
-- =============================================================================
-- NO vuelvas a correr este archivo en una base que ya tiene gente registrada.
-- schema.sql (el esquema/políticas) sí es seguro de re-correr las veces que
-- quieras; este archivo NO — aunque el "on conflict do nothing" evita
-- duplicados exactos por callsign, no hay ninguna razón para volver a
-- pegarlo una vez que el equipo ya está cargado. Si necesitas agregar un
-- integrante nuevo, hazlo desde Comandancia → Gestión de integrantes, no
-- editando este archivo.
-- =============================================================================

-- Nombres genéricos a propósito: este archivo es público (repo en GitHub),
-- así que no lleva datos personales reales. Los nombres reales de cada
-- integrante quedan en la base de datos (privada) apenas se registran en la
-- app y comandancia aprueba su solicitud — ver README para el flujo.
-- Se insertan SIN user_id: cada integrante queda "por reclamar" hasta que se
-- registre en la app con su callsign y comandancia apruebe la solicitud
-- (o, para la primera cuenta admin, se vincule a mano — ver instrucciones).
-- on conflict (callsign) hace este bloque seguro de correr más de una vez, y
-- no pisa nombres reales ya cargados en una base existente.

insert into public.players (callsign, name, rank, status, usual_role, usual_roles, is_admin, joined_at)
values
  ('1B9',  'Integrante 1B9',  'Veterano', 'activo', 'Squad Leader',   array['Squad Leader'],   true,  '2021-02-01'),
  ('2B9',  'Integrante 2B9',  'Titular',  'activo', 'LMG',            array['LMG'],            false, '2024-02-01'),
  ('3B9',  'Integrante 3B9',  'Veterano', 'activo', 'Sniper',         array['Sniper'],         false, '2021-02-01'),
  ('4B9',  'Integrante 4B9',  'Veterano', 'activo', 'Rifleman',       array['Rifleman'],       false, '2021-02-01'),
  ('5B9',  'Integrante 5B9',  'Veterano', 'activo', 'Radio Operator', array['Radio Operator'], false, '2021-02-01'),
  ('6B9',  'Integrante 6B9',  'Veterano', 'receso', 'Rifleman',       array['Rifleman'],       false, '2021-02-01'),
  ('7B9',  'Integrante 7B9',  'Veterano', 'activo', 'DMR',            array['DMR'],            false, '2021-02-01'),
  ('8B9',  'Integrante 8B9',  'Titular',  'activo', 'Medic',          array['Medic'],          false, '2022-01-01'),
  ('9B9',  'Integrante 9B9',  'Titular',  'activo', 'Grenadier',      array['Grenadier'],      false, '2023-09-01'),
  ('10B9', 'Integrante 10B9', 'Veterano', 'activo', 'Team Leader',    array['Team Leader'],    false, '2021-02-01'),
  ('12B9', 'Integrante 12B9', 'Titular',  'activo', 'Squad Leader',   array['Squad Leader'],   true,  '2024-01-01'),
  ('13B9', 'Integrante 13B9', 'Nuevo',    'activo', 'Rifleman',       array['Rifleman'],       false, '2026-01-01'),
  ('14B9', 'Integrante 14B9', 'Nuevo',    'activo', 'Rifleman',       array['Rifleman'],       false, '2026-04-01')
on conflict (callsign) do nothing;

insert into public.gear_checklist_items (name) values
  ('Protección ocular full-seal'),
  ('Dead rag'),
  ('Radio'),
  ('Chaleco táctico / plate carrier'),
  ('Casco'),
  ('Uniforme del equipo'),
  ('Botiquín personal (IFAK)'),
  ('Hidratación (camelback)'),
  ('Baterías de repuesto'),
  ('Linterna')
on conflict (name) do nothing;
