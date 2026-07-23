'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ModalShell from '@/components/ModalShell';
import {
  fmtCLP,
  fmtDate,
  fmtMonth,
  monthOf,
  sortByCallsign,
  upcomingEvents,
  type Player,
} from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { useGearChecklist } from '@/lib/gear-checklist';
import MemberEditor from '@/components/MemberEditor';
import PlayerProfileModal from '@/components/PlayerProfileModal';
import EventEditor from '@/components/EventEditor';
import AttendanceEditor from '@/components/AttendanceEditor';
import InventoryPanel from '@/components/InventoryPanel';
import { getReceiptUrl } from '@/lib/supabase/finance';

interface RegistrationRequestRow {
  id: string;
  user_id: string;
  matched_player_id: string | null;
  name: string;
  callsign: string;
  nickname: string | null;
  phone: string;
  photo_url: string | null;
  requested_at: string;
}

export default function ComandanciaPage() {
  const player = useCurrentPlayer();
  const {
    rsvps, players, dues, playerById, attendanceFor,
    announcements, addAnnouncement, updateAnnouncement, removeAnnouncement,
    receipts, acceptReceipt,
    addPlayer, updatePlayer, removePlayer, deletePlayer, adminNotes,
    setDuePaid, collectionAdjustment, setCollectionTotal, dueAmount, setDueAmount,
    events, addEvent, updateEvent, removeEvent,
  } = useStore();
  const [newGearItem, setNewGearItem] = useState('');

  // ------------------------------------------------------- checklist de equipo (Supabase real)
  const { items: gearChecklist, reload: reloadGearChecklist } = useGearChecklist();
  const [gearCounts, setGearCounts] = useState<Record<string, number>>({});
  const [gearActiveCount, setGearActiveCount] = useState(0);
  const [gearError, setGearError] = useState<string | null>(null);

  const loadGearCounts = async () => {
    if (!player.isAdmin) return;
    const supabase = createClient();
    const { data, error } = await supabase.from('players').select('gear').eq('status', 'activo');
    if (error) {
      setGearError(error.message);
      return;
    }
    const counts: Record<string, number> = {};
    (data ?? []).forEach((row) => {
      const gear = (row.gear as Record<string, boolean>) ?? {};
      Object.entries(gear).forEach(([item, has]) => {
        if (has) counts[item] = (counts[item] ?? 0) + 1;
      });
    });
    setGearCounts(counts);
    setGearActiveCount((data ?? []).length);
    setGearError(null);
  };

  useEffect(() => {
    loadGearCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isAdmin, gearChecklist]);

  const addChecklistItem = async () => {
    const name = newGearItem.trim();
    if (!name) return;
    const supabase = createClient();
    const { error } = await supabase.from('gear_checklist_items').insert({ name });
    if (error) {
      setGearError(error.message);
      return;
    }
    setNewGearItem('');
    await reloadGearChecklist();
  };

  const removeChecklistItem = async (name: string) => {
    const supabase = createClient();
    const { error } = await supabase.from('gear_checklist_items').delete().eq('name', name);
    if (error) {
      setGearError(error.message);
      return;
    }
    await reloadGearChecklist();
  };

  // ------------------------------------------------------- solicitudes (Supabase real)
  const [requests, setRequests] = useState<RegistrationRequestRow[]>([]);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [unclaimed, setUnclaimed] = useState<{ id: string; callsign: string; name: string }[]>([]);
  const [linkChoice, setLinkChoice] = useState<Record<string, string>>({});

  const loadRequests = async () => {
    if (!player.isAdmin) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('registration_requests')
      .select('id, user_id, matched_player_id, name, callsign, nickname, phone, photo_url, requested_at')
      .order('requested_at', { ascending: true });
    if (error) {
      setRequestsError(error.message);
      return;
    }
    setRequests((data as RegistrationRequestRow[]) ?? []);
    setRequestsError(null);
    const { data: free } = await supabase.from('players').select('id, callsign, name').is('user_id', null);
    setUnclaimed(free ?? []);
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isAdmin]);

  // Actualización en vivo: si llega una solicitud de ingreso nueva mientras
  // comandancia tiene la pantalla abierta, aparece al instante sin recargar.
  useEffect(() => {
    if (!player.isAdmin) return;
    const supabase = createClient();
    const channel = supabase
      .channel('gear-locker-requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registration_requests' }, () => loadRequests())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.isAdmin]);

  const localMatchByCallsign = (callsign: string) =>
    players.find((p) => p.callsign.toLowerCase() === callsign.toLowerCase());

  const approveRequest = async (req: RegistrationRequestRow) => {
    setBusyRequestId(req.id);
    const supabase = createClient();
    const chosen = linkChoice[req.id] ?? req.matched_player_id ?? 'new';

    if (chosen !== 'new') {
      const { error } = await supabase
        .from('players')
        .update({
          user_id: req.user_id,
          name: req.name,
          nickname: req.nickname,
          phone: req.phone,
          photo_url: req.photo_url,
        })
        .eq('id', chosen);
      if (error) {
        setBusyRequestId(null);
        setRequestsError('No se pudo vincular la ficha: ' + error.message);
        return;
      }
      const targetCallsign = unclaimed.find((u) => u.id === chosen)?.callsign ?? req.callsign;
      const local = localMatchByCallsign(targetCallsign);
      if (local) {
        updatePlayer(local.id, {
          name: req.name,
          nickname: req.nickname ?? undefined,
          phone: req.phone,
          photoUrl: req.photo_url ?? undefined,
        });
      }
    } else {
      const { data: inserted, error } = await supabase
        .from('players')
        .insert({
          user_id: req.user_id,
          callsign: req.callsign,
          name: req.name,
          nickname: req.nickname,
          phone: req.phone,
          photo_url: req.photo_url,
          rank: 'Nuevo',
          status: 'activo',
          usual_role: 'Rifleman',
          usual_roles: ['Rifleman'],
          is_admin: false,
        })
        .select()
        .single();
      if (error) {
        setBusyRequestId(null);
        setRequestsError('No se pudo crear la ficha: ' + error.message);
        return;
      }
      addPlayer({
        id: `sb-${inserted.id}`,
        supaId: inserted.id,
        callsign: req.callsign,
        name: req.name,
        nickname: req.nickname ?? undefined,
        rank: 'Nuevo',
        status: 'activo',
        usualRole: 'Rifleman',
        usualRoles: ['Rifleman'],
        isAdmin: false,
        joinedAt: new Date().toISOString().slice(0, 10),
        phone: req.phone,
        photoUrl: req.photo_url ?? undefined,
      });
    }

    await supabase.from('registration_requests').delete().eq('id', req.id);
    setBusyRequestId(null);
    await loadRequests();
  };

  const rejectRequest = async (req: RegistrationRequestRow) => {
    setBusyRequestId(req.id);
    const supabase = createClient();
    const { error } = await supabase.from('registration_requests').delete().eq('id', req.id);
    setBusyRequestId(null);
    if (error) {
      setRequestsError('No se pudo rechazar: ' + error.message);
      return;
    }
    await loadRequests();
  };

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annSeverity, setAnnSeverity] = useState<'info' | 'warn' | 'crit'>('info');
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Player | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingEvent, setEditingEvent] = useState<(typeof events)[number] | null>(null);
  const [attendanceEventId, setAttendanceEventId] = useState<string | null>(null);
  const [addingEvent, setAddingEvent] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<string | null>(null);
  const openReceipt = async (storagePath: string) => {
    const url = await getReceiptUrl(storagePath);
    if (url) setViewReceipt(url);
  };
  const [activeTab, setActiveTab] = useState<'resumen' | 'equipo' | 'eventos' | 'finanzas' | 'inventario'>('resumen');
  const [editingCollection, setEditingCollection] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState('');
  const [editingDueAmount, setEditingDueAmount] = useState(false);
  const [dueAmountDraft, setDueAmountDraft] = useState('');
  const [financeYear, setFinanceYear] = useState(String(new Date().getFullYear()));
  const [financeMonth, setFinanceMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);

  if (!player.isAdmin) {
    return <div className="lat-alert crit">Acceso restringido a comandancia.</div>;
  }

  const active = sortByCallsign(players.filter((p) => p.status === 'activo'));
  const next = upcomingEvents(new Date(), events)[0];
  const nextRsvps = next ? rsvps[next.id] ?? {} : {};
  const confirmed = Object.values(nextRsvps).filter((s) => s === 'va').length;
  const noAnswer = active.filter((p) => !nextRsvps[p.id]);

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthDues = dues.filter((d) => d.month === currentMonth);
  const paidThisMonth = monthDues.filter((d) => d.paid).length;
  const collectPct = monthDues.length ? Math.round((paidThisMonth / monthDues.length) * 100) : 0;
  const totalDebt = dues.filter((d) => !d.paid).reduce((s, d) => s + d.amount, 0);
  const paidFromDues = dues.filter((d) => d.paid).reduce((s, d) => s + d.amount, 0);
  const totalCollected = paidFromDues + collectionAdjustment;

  const pendingReceipts = receipts.filter((r) => r.status === 'revision');
  const financeYears = [...new Set(dues.map((due) => due.month.slice(0, 4)))].sort((a, b) => b.localeCompare(a));
  const financeMonths = [...new Set(dues.filter((due) => due.month.startsWith(`${financeYear}-`)).map((due) => due.month))].sort();
  const periodDues = dues.filter((due) => due.month.startsWith(`${financeYear}-`) && (financeMonth === 'all' || due.month === financeMonth));
  const paidPeriod = periodDues.filter((due) => due.paid);
  const pendingPeriod = periodDues.filter((due) => !due.paid);
  const paidPct = periodDues.length ? Math.round((paidPeriod.length / periodDues.length) * 100) : 0;
  const collectedPeriod = paidPeriod.reduce((sum, due) => sum + due.amount, 0);
  const outstandingPeriod = pendingPeriod.reduce((sum, due) => sum + due.amount, 0);
  const moneyPct = collectedPeriod + outstandingPeriod ? Math.round((collectedPeriod / (collectedPeriod + outstandingPeriod)) * 100) : 0;
  const pendingPlayers = players.map((member) => ({
    member,
    dues: pendingPeriod.filter((due) => due.playerId === member.id),
  })).filter((item) => item.dues.length > 0);

  const publish = () => {
    if (!annTitle.trim() || !annBody.trim()) return;
    const draft = { title: annTitle.trim(), body: annBody.trim(), severity: annSeverity };
    if (editingAnnId) {
      updateAnnouncement(editingAnnId, draft);
    } else {
      addAnnouncement(draft);
    }
    setAnnTitle('');
    setAnnBody('');
    setAnnSeverity('info');
    setEditingAnnId(null);
  };

  const startAnnEdit = (a: (typeof announcements)[number]) => {
    setEditingAnnId(a.id);
    setAnnTitle(a.title);
    setAnnBody(a.body);
    setAnnSeverity(a.severity);
  };

  const cancelAnnEdit = () => {
    setEditingAnnId(null);
    setAnnTitle('');
    setAnnBody('');
    setAnnSeverity('info');
  };

  const pendingFor = (id: string) => periodDues.filter((due) => due.playerId === id && !due.paid);

  return (
    <>
      <p className="page-intro">
        Panel de comandancia: publica avisos, aprueba ingresos, gestiona al equipo y controla cuotas y comprobantes.
      </p>

      <div className="seg-tabs command-tabs" role="tablist" aria-label="Secciones de comandancia">
        <button className={activeTab === 'resumen' ? 'active' : ''} onClick={() => setActiveTab('resumen')} role="tab">
          Resumen
        </button>
        <button className={activeTab === 'equipo' ? 'active' : ''} onClick={() => setActiveTab('equipo')} role="tab">
          Equipo {requests.length > 0 && <span className="badge">{requests.length}</span>}
        </button>
        <button className={activeTab === 'eventos' ? 'active' : ''} onClick={() => setActiveTab('eventos')} role="tab">
          Eventos
        </button>
        <button className={activeTab === 'finanzas' ? 'active' : ''} onClick={() => setActiveTab('finanzas')} role="tab">
          Finanzas {pendingReceipts.length > 0 && <span className="badge">{pendingReceipts.length}</span>}
        </button>
        <button className={activeTab === 'inventario' ? 'active' : ''} onClick={() => setActiveTab('inventario')} role="tab">
          Inventario
        </button>
      </div>

      {/* --------------------------------------------------- métricas */}
      <div className="grid cols-5" hidden={activeTab !== 'resumen'}>
        <div className="lat-panel">
          <div className="panel-head"><h3>Integrantes</h3></div>
          <div className="big-num">{active.length}</div>
          <span className="tiny mut">
            {players.length - active.length > 0 && `${players.length - active.length} en receso`}
          </span>
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>Cuotas {fmtMonth(currentMonth)}</h3></div>
          <div className={`big-num ${collectPct >= 80 ? 'ok' : collectPct >= 50 ? 'warn' : 'crit'}`}>
            {collectPct}<span className="unit">%</span>
          </div>
          <span className="tiny mut">{paidThisMonth}/{monthDues.length} pagadas</span>
        </div>
        <div className="lat-panel collection-card">
          <div className="panel-head">
            <h3>Total recaudado</h3>
            <button
              className="lat-btn ghost sm"
              onClick={() => {
                setCollectionDraft(String(totalCollected));
                setEditingCollection(true);
              }}
            >
              Editar
            </button>
          </div>
          <div className="big-num ok" style={{ fontSize: 26 }}>{fmtCLP(totalCollected)}</div>
          <span className="tiny mut">Cuotas pagadas y ajustes de caja</span>
          {editingCollection && (
            <div className="collection-editor">
              <input
                className="lat-input"
                type="number"
                min="0"
                step="1000"
                value={collectionDraft}
                onChange={(e) => setCollectionDraft(e.target.value)}
                aria-label="Total recaudado"
                autoFocus
              />
              <button
                className="lat-btn primary sm"
                onClick={() => {
                  const nextTotal = Number(collectionDraft);
                  if (Number.isFinite(nextTotal) && nextTotal >= 0) {
                    setCollectionTotal(nextTotal);
                    setEditingCollection(false);
                  }
                }}
              >
                Guardar
              </button>
              <button className="lat-btn ghost sm" onClick={() => setEditingCollection(false)}>Cancelar</button>
            </div>
          )}
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>Deuda total</h3></div>
          <div className={`big-num ${totalDebt === 0 ? 'ok' : 'crit'}`} style={{ fontSize: 26 }}>
            {fmtCLP(totalDebt)}
          </div>
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>Por revisar</h3></div>
          <div className={`big-num ${pendingReceipts.length + requests.length > 0 ? 'warn' : 'ok'}`}>
            {pendingReceipts.length + requests.length}
          </div>
          <span className="tiny mut">
            {requests.length} ingresos · {pendingReceipts.length} comprobantes
          </span>
        </div>
      </div>

      {/* --------------------------------------------------- solicitudes */}
      {activeTab === 'equipo' && (
        <>
          <div className="section-title">Solicitudes de ingreso</div>
          {requestsError && <div className="lat-alert warn" style={{ marginBottom: 10 }}>{requestsError}</div>}
          {requests.length === 0 && !requestsError && (
            <div className="empty-state" style={{ marginBottom: 14 }}>
              No hay solicitudes pendientes. Cuando alguien se registre en la app, aparecerá aquí para que la apruebes o rechaces.
            </div>
          )}
          <div className="grid cols-2">
            {requests.map((r) => {
              const busy = busyRequestId === r.id;
              const choice = linkChoice[r.id] ?? r.matched_player_id ?? 'new';
              return (
              <div key={r.id} className="lat-panel">
                <div className="roster-card">
                  <span className="avatar lg">
                    {r.photo_url ? <img src={r.photo_url} alt={r.callsign} /> : '?'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="rc-name">{r.name.toUpperCase()}</div>
                    <div className="rc-sub">{r.callsign.toUpperCase()}{r.nickname ? ` · ${r.nickname}` : ''} · {r.phone}</div>
                    <div className="rc-sub dim-t">Solicitado el {fmtDate(r.requested_at.slice(0, 10))}</div>
                  </div>
                </div>
                <div className="lat-field">
                  <label>Vincular con</label>
                  <select
                    className="lat-select"
                    value={choice}
                    onChange={(e) => setLinkChoice((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  >
                    <option value="new">— Crear ficha nueva —</option>
                    {unclaimed.map((u) => (
                      <option key={u.id} value={u.id}>{u.callsign} · {u.name}</option>
                    ))}
                  </select>
                </div>
                <div className={`lat-alert ${choice !== 'new' ? 'ok' : 'warn'}`}>
                  {choice !== 'new'
                    ? `Se vinculará con la ficha existente. Se conservarán su rango, rol, estado, antigüedad y acceso.`
                    : 'Al aprobar se creará un integrante nuevo.'}
                </div>
                <div className="row">
                  <button className="lat-btn ok-line" disabled={busy} onClick={() => approveRequest(r)}>
                    {busy ? 'Procesando...' : choice !== 'new' ? '✓ Aprobar y vincular' : '✓ Aprobar y crear ficha'}
                  </button>
                  <button className="lat-btn danger" disabled={busy} onClick={() => rejectRequest(r)}>
                    ✗ Rechazar
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'finanzas' && (
        <>
      {/* --------------------------------------------------- cuota mensual */}
      <div className="section-title">Cuota mensual</div>
      <div className="lat-panel">
        <div className="panel-head">
          <h3>Valor de la cuota</h3>
          {!editingDueAmount && (
            <button
              className="lat-btn ghost sm"
              onClick={() => {
                setDueAmountDraft(String(dueAmount));
                setEditingDueAmount(true);
              }}
            >
              Editar
            </button>
          )}
        </div>
        <div className="big-num" style={{ fontSize: 26 }}>{fmtCLP(dueAmount)}</div>
        <span className="tiny mut">
          Se usa para las cuotas que se generan automáticamente cada mes. Cambiarlo no afecta los meses ya generados.
        </span>
        {editingDueAmount && (
          <div className="collection-editor">
            <input
              className="lat-input"
              type="number"
              min="0"
              step="500"
              value={dueAmountDraft}
              onChange={(e) => setDueAmountDraft(e.target.value)}
              aria-label="Valor de la cuota mensual"
              autoFocus
            />
            <button
              className="lat-btn primary sm"
              onClick={() => {
                const next = Number(dueAmountDraft);
                if (Number.isFinite(next) && next >= 0) {
                  setDueAmount(next);
                  setEditingDueAmount(false);
                }
              }}
            >
              Guardar
            </button>
            <button className="lat-btn ghost sm" onClick={() => setEditingDueAmount(false)}>Cancelar</button>
          </div>
        )}
      </div>

      {/* --------------------------------------------------- comprobantes */}
      <div className="section-title">Comprobantes de pago</div>
      <div className="lat-panel">
        {receipts.length === 0 ? (
          <div className="empty-state">
            Cuando alguien suba un comprobante en Cuotas, aparecerá aquí para que lo revises y marques el mes como pagado.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="lat-table">
              <thead>
                <tr><th>Integrante</th><th>Mes</th><th>Archivo</th><th>Subido</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {receipts.map((r) => {
                  const p = playerById(r.playerId);
                  return (
                    <tr key={r.id}>
                      <td><span className="acc">{p?.callsign}</span> {p?.name.toUpperCase()}</td>
                      <td>{fmtMonth(r.month)}</td>
                      <td>
                        <button className="lat-btn ghost sm" onClick={() => openReceipt(r.storagePath)}>
                          Ver
                        </button>
                      </td>
                      <td className="mono-dim">{r.uploadedAt}</td>
                      <td className={r.status === 'aceptado' ? 'badge-ok' : 'badge-warn'}>
                        {r.status === 'aceptado' ? '✓ ACEPTADO' : 'EN REVISIÓN'}
                      </td>
                      <td>
                        {r.status === 'revision' && (
                          <button className="lat-btn ok-line sm" onClick={() => acceptReceipt(r.id)}>
                            Aceptar y marcar pagada
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

        </>
      )}

      {activeTab === 'resumen' && (
        <>
      {/* --------------------------------------------------- avisos */}
      <div className="section-title">Avisos del feed</div>
      <div className="grid cols-2">
        <div className="lat-panel">
          <div className="panel-head">
            <h3>{editingAnnId ? 'Editar aviso' : 'Publicar aviso'}</h3>
            {editingAnnId && (
              <button className="lat-btn ghost sm" onClick={cancelAnnEdit}>Cancelar edición</button>
            )}
          </div>
          <span className="help">
            {editingAnnId
              ? 'Estás editando un aviso ya publicado — al guardar se actualiza para todo el equipo.'
              : 'Lo que publiques aquí aparece de inmediato en el HQ de todo el equipo.'}
          </span>
          <div className="lat-field">
            <label>Título</label>
            <input className="lat-input" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Ej: Cambio de fecha del entrenamiento" />
          </div>
          <div className="lat-field">
            <label>Mensaje</label>
            <textarea className="lat-textarea" rows={3} value={annBody} onChange={(e) => setAnnBody(e.target.value)} placeholder="Escribe el detalle del aviso..." />
          </div>
          <div className="lat-field">
            <label>Importancia</label>
            <select className="lat-select" value={annSeverity} onChange={(e) => setAnnSeverity(e.target.value as 'info' | 'warn' | 'crit')}>
              <option value="info">Normal</option>
              <option value="warn">Importante (amarillo)</option>
              <option value="crit">Urgente (rojo)</option>
            </select>
          </div>
          <button className="lat-btn primary" onClick={publish} disabled={!annTitle.trim() || !annBody.trim()}>
            {editingAnnId ? 'Guardar cambios' : 'Publicar en el feed'}
          </button>
        </div>

        <div className="lat-panel">
          <div className="panel-head"><h3>Avisos publicados</h3></div>
          {announcements.length === 0 && <div className="empty-state">Sin avisos publicados.</div>}
          {announcements.map((a) => (
            <div key={a.id} className={`lat-alert ${a.severity === 'info' ? '' : a.severity}`} style={{ position: 'relative' }}>
              <div className="row between">
                <div className="alert-title">{fmtDate(a.date)}</div>
                <span className="row" style={{ gap: 4 }}>
                  <button className="lat-btn ghost sm" onClick={() => startAnnEdit(a)}>Editar</button>
                  <button className="lat-btn danger sm" onClick={() => removeAnnouncement(a.id)}>Eliminar</button>
                </span>
              </div>
              <strong style={{ display: 'block' }}>{a.title}</strong>
              <span className="help">{a.body}</span>
            </div>
          ))}
        </div>
      </div>

        </>
      )}

      {activeTab === 'equipo' && (
        <>
      {/* --------------------------------------------------- integrantes */}
      <div className="section-title">Gestión de integrantes</div>
      <div className="lat-panel">
        <div className="row between">
          <span className="help">Edita la ficha de cada integrante, cambia su estado o su acceso de comandancia.</span>
          <button className="lat-btn" onClick={() => setAdding(true)}>+ Agregar integrante</button>
        </div>
        <div className="table-scroll">
          <table className="lat-table">
            <thead>
              <tr><th>Callsign</th><th>Nombre</th><th>Nickname</th><th>Teléfono</th><th>Rango</th><th>Estado</th><th>Admin</th><th></th></tr>
            </thead>
            <tbody>
              {active.map((p) => (
                <tr key={p.id}>
                  <td className="acc">{p.callsign}</td>
                  <td>{p.name}</td>
                  <td className="mono-dim">{p.nickname ?? '—'}</td>
                  <td className="mono-dim">{p.phone ?? '—'}</td>
                  <td className="mono-dim">{p.rank}</td>
                  <td className="badge-ok">{p.status.toUpperCase()}</td>
                  <td>{p.isAdmin ? '✦' : '—'}</td>
                  <td>
                    <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <button className="lat-btn ghost sm" onClick={() => setProfileId(p.id)}>Ver ficha</button>
                      <button className="lat-btn ghost sm" onClick={() => setEditing(p)}>Editar</button>
                      <button
                        className="lat-btn danger sm"
                        onClick={() => {
                          if (confirm(`¿Desactivar a ${p.callsign} ${p.name}? Su ficha y todas sus cuotas se conservarán.`)) {
                            removePlayer(p.id);
                          }
                        }}
                      >
                        Desactivar
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {players.length - active.length > 0 && (
          <>
            <div className="tiny dim-t" style={{ marginTop: 14 }}>Inactivos</div>
            <div className="table-scroll">
              <table className="lat-table">
                <thead>
                  <tr><th>Callsign</th><th>Nombre</th><th>Nickname</th><th>Teléfono</th><th>Rango</th><th>Estado</th><th>Admin</th><th></th></tr>
                </thead>
                <tbody>
                  {sortByCallsign(players.filter((p) => p.status !== 'activo')).map((p) => (
                    <tr key={p.id} style={{ opacity: 0.55 }}>
                      <td className="acc">{p.callsign}</td>
                      <td>{p.name}</td>
                      <td className="mono-dim">{p.nickname ?? '—'}</td>
                      <td className="mono-dim">{p.phone ?? '—'}</td>
                      <td className="mono-dim">{p.rank}</td>
                      <td className="badge-warn">{p.status.toUpperCase()}</td>
                      <td>{p.isAdmin ? '✦' : '—'}</td>
                      <td>
                        <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                          <button className="lat-btn ghost sm" onClick={() => setProfileId(p.id)}>Ver ficha</button>
                          <button className="lat-btn ghost sm" onClick={() => setEditing(p)}>Editar</button>
                          <button
                            className="lat-btn danger sm"
                            onClick={async () => {
                              if (!confirm(`¿ELIMINAR definitivamente a ${p.callsign} ${p.name}? Se borra su ficha, cuotas y asistencia. No se puede deshacer.`)) return;
                              if (p.supaId) {
                                await createClient().from('players').delete().eq('id', p.supaId);
                              }
                              deletePlayer(p.id);
                            }}
                          >
                            Eliminar
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* --------------------------------------------------- checklist de equipo */}
      <div className="section-title">Checklist de equipo personal</div>
      <div className="lat-panel">
        <span className="help">
          Esta lista aparece en el perfil de cada integrante para que marque qué tiene. Agrega o quita items según el estándar del equipo.
        </span>
        {gearError && <div className="lat-alert warn">{gearError}</div>}
        <div className="gear-grid">
          {gearChecklist.map((item) => {
            const haveCount = gearCounts[item] ?? 0;
            return (
              <span key={item} className="gear-check readonly on" style={{ justifyContent: 'space-between' }}>
                <span>{item}</span>
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <span className="tiny mut" title="Integrantes activos que lo tienen">{haveCount}/{gearActiveCount}</span>
                  <button
                    className="cr-btn"
                    style={{ minHeight: 22, padding: '1px 7px' }}
                    title="Quitar de la lista"
                    onClick={() => {
                      if (confirm(`¿Quitar "${item}" de la checklist de todo el equipo?`)) removeChecklistItem(item);
                    }}
                  >
                    ✗
                  </button>
                </span>
              </span>
            );
          })}
          {gearChecklist.length === 0 && <div className="empty-state">Aún no hay items en la checklist.</div>}
        </div>
        <div className="row">
          <input
            className="lat-input"
            style={{ maxWidth: 320 }}
            value={newGearItem}
            onChange={(e) => setNewGearItem(e.target.value)}
            placeholder="Ej: Guantes tácticos"
            onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
          />
          <button
            className="lat-btn"
            disabled={!newGearItem.trim()}
            onClick={addChecklistItem}
          >
            + Agregar item
          </button>
        </div>
      </div>

        </>
      )}

      {activeTab === 'resumen' && (
        <>
      {/* --------------------------------------------------- próximo evento */}
      {next && (
        <>
          <div className="section-title">Próximo evento — {next.name}</div>
          <div className="grid cols-2">
            <div className="lat-panel">
              <div className="panel-head">
                <h3>Estado RSVP</h3>
                <Link href={`/eventos/${next.id}`} className="lat-btn ghost sm">Briefing →</Link>
              </div>
              <div className="kv"><span className="k">Confirmados</span><span className="v ok">{confirmed}</span></div>
              <div className="kv">
                <span className="k">Sin responder</span>
                <span className={`v ${noAnswer.length > 0 ? 'warn' : 'ok'}`}>{noAnswer.length}</span>
              </div>
              {noAnswer.length > 0 && (
                <div className="row">
                  {noAnswer.map((p) => (
                    <span key={p.id} className="lat-chip dim">{p.callsign} {p.name.toUpperCase()}</span>
                  ))}
                </div>
              )}
              <div className="kv">
                <span className="k">Roles asignados</span>
                <span className="v">{next.assignments.length}/{confirmed}</span>
              </div>
            </div>
            <div className="lat-panel">
              <div className="panel-head"><h3>Checklist pre-evento</h3></div>
              <div className="kv"><span className="k">SOI publicado</span><span className={`v ${next.comms.length ? 'ok' : 'crit'}`}>{next.comms.length ? 'SÍ' : 'NO'}</span></div>
              <div className="kv"><span className="k">Mapas cargados</span><span className={`v ${next.files.some((f) => f.kind === 'mapa') ? 'ok' : 'crit'}`}>{next.files.some((f) => f.kind === 'mapa') ? 'SÍ' : 'NO'}</span></div>
              <div className="kv"><span className="k">ORBAT completo</span><span className={`v ${next.assignments.length >= confirmed ? 'ok' : 'warn'}`}>{next.assignments.length >= confirmed ? 'SÍ' : 'PARCIAL'}</span></div>
              <div className="kv"><span className="k">Límites FPS definidos</span><span className={`v ${next.fpsLimits.length ? 'ok' : 'crit'}`}>{next.fpsLimits.length ? 'SÍ' : 'NO'}</span></div>
            </div>
          </div>
        </>
      )}

        </>
      )}

      {activeTab === 'finanzas' && (
        <>
      {/* --------------------------------------------------- cuotas */}
      <div className="section-title">Estado de cuotas</div>
      <div className="finance-filter-bar lat-panel">
        <div className="lat-field">
          <label>Año</label>
          <select className="lat-select" value={financeYear} onChange={(event) => { setFinanceYear(event.target.value); setFinanceMonth('all'); }}>
            {financeYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div className="lat-field">
          <label>Mes</label>
          <select className="lat-select" value={financeMonth} onChange={(event) => setFinanceMonth(event.target.value)}>
            <option value="all">Todo el año</option>
            {financeMonths.map((month) => <option key={month} value={month}>{fmtMonth(month)}</option>)}
          </select>
        </div>
        <span className="help">Cada mes se genera automáticamente una cuota nueva para los integrantes activos.</span>
      </div>

      <div className="finance-overview-grid">
        <div className="lat-panel finance-chart-card">
          <div className="panel-head"><h3>Cuotas pagadas</h3></div>
          <div className="finance-donut" style={{ background: `conic-gradient(var(--ok) 0 ${paidPct}%, var(--crit) ${paidPct}% 100%)` }}><span>{paidPct}%</span></div>
          <div className="finance-legend"><span><i className="ok" />{paidPeriod.length} pagadas</span><span><i className="crit" />{pendingPeriod.length} pendientes</span></div>
        </div>
        <div className="lat-panel finance-chart-card">
          <div className="panel-head"><h3>Recaudación del período</h3></div>
          <div className="finance-donut" style={{ background: `conic-gradient(var(--accent) 0 ${moneyPct}%, rgba(255,255,255,.08) ${moneyPct}% 100%)` }}><span>{moneyPct}%</span></div>
          <div className="finance-legend"><span><i className="accent" />{fmtCLP(collectedPeriod)}</span><span><i className="dim" />{fmtCLP(outstandingPeriod)} por cobrar</span></div>
        </div>
        <div className="lat-panel finance-pending-panel">
          <div className="panel-head"><h3>Pendientes de pago ({pendingPlayers.length})</h3></div>
          <div className="finance-pending-list">
            {pendingPlayers.map(({ member, dues: memberDues }) => (
              <div key={member.id}>
                <span><strong className="acc">{member.callsign}</strong> {member.nickname || member.name}<small>{member.status === 'inactivo' ? 'INACTIVO · historial' : memberDues.map((due) => monthOf(due.month)).join(' · ')}</small></span>
                <strong className="critc">{fmtCLP(memberDues.reduce((sum, due) => sum + due.amount, 0))}</strong>
              </div>
            ))}
            {pendingPlayers.length === 0 && <div className="empty-state">No hay pagos pendientes para este filtro.</div>}
          </div>
        </div>
      </div>

      <div className="section-title">Cuotas — matriz por mes</div>
      <div className="lat-panel">
        <span className="help">Haz clic en un círculo para marcar o desmarcar un mes como pagado.</span>
        <div className="table-scroll desktop-dues">
          <table className="lat-table">
            <thead>
              <tr>
                <th>Integrante</th>
                {financeMonths.map((m) => <th key={m}>{monthOf(m)}</th>)}
                <th>Deuda</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const pending = pendingFor(p.id);
                return (
                  <tr key={p.id} style={p.status === 'receso' ? { opacity: 0.5 } : undefined}>
                    <td>
                      <span className="acc">{p.callsign}</span> {p.name.toUpperCase()}
                    </td>
                    {financeMonths.map((m) => {
                      const due = dues.find((d) => d.playerId === p.id && d.month === m);
                      if (!due) return <td key={m} className="mono-dim">·</td>;
                      return (
                        <td key={m}>
                          <button
                            className={`cr-btn ${due.paid ? 'copied' : ''}`}
                            style={{ minHeight: 24, padding: '2px 8px' }}
                            title={due.paid ? 'Marcar como pendiente' : 'Marcar como pagada'}
                            onClick={() => setDuePaid(p.id, m, !due.paid)}
                          >
                            {due.paid ? '●' : '○'}
                          </button>
                        </td>
                      );
                    })}
                    <td className={pending.length ? 'badge-crit' : 'badge-ok'}>
                      {pending.length ? fmtCLP(pending.reduce((s, d) => s + d.amount, 0)) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="dues-mobile-list">
          {players.map((member) => {
            const memberPending = pendingFor(member.id);
            const memberDebt = memberPending.reduce((sum, due) => sum + due.amount, 0);
            return (
              <div key={member.id} className="dues-mobile-card" style={member.status === 'receso' ? { opacity: 0.6 } : undefined}>
                <div className="dues-mobile-head">
                  <div>
                    <strong><span className="acc">{member.callsign}</span> {member.nickname || member.name}</strong>
                    <span>{member.name}</span>
                  </div>
                  <div className={memberDebt ? 'critc' : 'okc'}>
                    <small>Deuda</small>
                    <strong>{memberDebt ? fmtCLP(memberDebt) : 'Al día'}</strong>
                  </div>
                </div>
                <div className="dues-month-grid">
                  {financeMonths.map((month) => {
                    const due = dues.find((item) => item.playerId === member.id && item.month === month);
                    return (
                      <div key={month} className={!due ? 'no-due' : due.paid ? 'paid' : 'pending'}>
                        <span>{monthOf(month)}</span>
                        {due ? (
                          <button
                            title={due.paid ? 'Marcar como pendiente' : 'Marcar como pagada'}
                            onClick={() => setDuePaid(member.id, month, !due.paid)}
                          >
                            {due.paid ? '✓' : 'Pend.'}
                          </button>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <span className="tiny dim-t">● pagada · ○ pendiente · &nbsp;· sin cuota (receso / ingreso posterior)</span>
      </div>

        </>
      )}

      {activeTab === 'equipo' && (
        <>
      {/* --------------------------------------------------- asistencia + notas */}
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="lat-panel">
          <div className="panel-head"><h3>Asistencia por integrante</h3></div>
          {active
            .map((p) => ({ p, att: attendanceFor(p.id) }))
            .sort((a, b) => b.att - a.att)
            .map(({ p, att }) => (
              <div key={p.id} className="pbar-row">
                <span className="pbar-label">{p.callsign} {p.name.toUpperCase()}</span>
                <div className={`pbar ${att >= 70 ? 'ok' : att >= 40 ? 'warn' : 'crit'}`}>
                  <span style={{ width: `${att}%` }} />
                </div>
                <span className="pbar-val">{att}%</span>
              </div>
            ))}
        </div>

        <div className="lat-panel">
          <div className="panel-head"><h3>Notas de comandancia</h3></div>
          {Object.entries(adminNotes).map(([pid, note]) => {
            const member = playerById(pid);
            return member ? (
              <button key={pid} className="command-note-preview" type="button" onClick={() => setProfileId(pid)}>
                <span className="avatar sm">{member.callsign}</span>
                <span>
                  <strong>{member.name.toUpperCase()}</strong>
                  <small>{note}</small>
                </span>
                <span className="profile-open-arrow">›</span>
              </button>
            ) : null;
          })}
          {Object.keys(adminNotes).length === 0 && <div className="empty-state">No hay notas privadas registradas.</div>}
          <span className="tiny dim-t">Abre una ficha para agregar, editar o quitar su nota. Solo Comandancia puede verlas.</span>
        </div>
      </div>

        </>
      )}

      {activeTab === 'eventos' && (
        <>
          <div className="section-title">Eventos publicados</div>
          <div className="lat-panel">
            <div className="row between event-admin-head">
              <span className="help">Crea el evento, configura su briefing y ajusta las señales de radio que utilizará el equipo.</span>
              <button className="lat-btn primary" type="button" onClick={() => setAddingEvent(true)}>+ Publicar evento</button>
            </div>
            <div className="event-admin-list">
              {[...events].sort((a, b) => b.date.localeCompare(a.date)).map((event) => (
                <div className="event-admin-row" key={event.id}>
                  <div className="event-date-block">
                    <span className="d">{parseInt(event.date.slice(8), 10)}</span>
                    <span className="m">{monthOf(event.date)}</span>
                  </div>
                  <div className="event-admin-info">
                    <strong>{event.name}</strong>
                    <span>{fmtDate(event.date)} · {event.startTime} · {event.location}</span>
                    <small>
                      {event.comms.length} señales de radio · {event.type}
                      {new Date(event.date + 'T23:59') < new Date() && ` · ${event.attended?.length ?? 0} asistieron`}
                    </small>
                  </div>
                  <div className="event-admin-actions">
                    <Link href={`/eventos/${event.id}`} className="lat-btn ghost sm">Ver briefing</Link>
                    <button className="lat-btn sm" type="button" onClick={() => setAttendanceEventId(event.id)}>Asistencia</button>
                    <button className="lat-btn sm" type="button" onClick={() => setEditingEvent(event)}>Editar</button>
                    <button className="lat-btn danger sm" type="button" onClick={() => {
                      if (confirm(`¿Eliminar el evento ${event.name}? También se quitarán sus respuestas y archivos.`)) removeEvent(event.id);
                    }}>Eliminar</button>
                  </div>
                </div>
              ))}
              {events.length === 0 && <div className="empty-state">Todavía no hay eventos publicados.</div>}
            </div>
          </div>
        </>
      )}

      {activeTab === 'inventario' && <InventoryPanel />}
      {/* --------------------------------------------------- modales */}
      {attendanceEventId && (
        <AttendanceEditor eventId={attendanceEventId} onClose={() => setAttendanceEventId(null)} />
      )}
      {(editingEvent || addingEvent) && (
        <EventEditor
          initial={editingEvent ?? undefined}
          onClose={() => { setEditingEvent(null); setAddingEvent(false); }}
          onSave={(draft) => {
            if (editingEvent) updateEvent(editingEvent.id, draft);
            else addEvent(draft);
            setEditingEvent(null);
            setAddingEvent(false);
          }}
        />
      )}

      {profileId && playerById(profileId) && (
        <PlayerProfileModal
          player={playerById(profileId)!}
          onClose={() => setProfileId(null)}
          onEdit={() => {
            const member = playerById(profileId);
            if (member) setEditing(member);
            setProfileId(null);
          }}
        />
      )}

      {(editing || adding) && (
        <MemberEditor
          initial={editing ?? undefined}
          onClose={() => { setEditing(null); setAdding(false); }}
          onSave={async (data) => {
            if (editing) {
              if (editing.supaId) {
                const { error } = await createClient()
                  .from('players')
                  .update({
                    callsign: data.callsign,
                    name: data.name,
                    nickname: data.nickname ?? null,
                    phone: data.phone ?? null,
                    rank: data.rank,
                    status: data.status === 'inactivo' ? 'receso' : data.status,
                    usual_role: data.usualRole,
                    usual_roles: data.usualRoles,
                    is_admin: data.isAdmin,
                  })
                  .eq('id', editing.supaId);
                if (error) {
                  alert('No se pudo guardar el cambio: ' + error.message);
                  return;
                }
              }
              updatePlayer(editing.id, data);
            } else {
              const { data: inserted, error } = await createClient()
                .from('players')
                .insert({
                  callsign: data.callsign,
                  name: data.name,
                  nickname: data.nickname ?? null,
                  phone: data.phone ?? null,
                  rank: data.rank,
                  status: data.status === 'inactivo' ? 'receso' : data.status,
                  usual_role: data.usualRole,
                  usual_roles: data.usualRoles,
                  is_admin: data.isAdmin,
                })
                .select('id')
                .single();
              if (error || !inserted) {
                alert('No se pudo crear la ficha: ' + (error?.message ?? 'error desconocido'));
                return;
              }
              addPlayer({ ...data, id: `sb-${inserted.id}`, supaId: inserted.id });
            }
            setEditing(null);
            setAdding(false);
          }}
        />
      )}

      {viewReceipt && (
        <ModalShell onClose={() => setViewReceipt(null)} style={{ maxWidth: 640 }}>
            <h2>Comprobante</h2>
            <img
              src={viewReceipt}
              alt="Comprobante"
              style={{ maxWidth: '100%', border: '1px solid var(--border)' }}
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="help">Si no se ve una imagen arriba, es un documento — descárgalo para verlo.</span>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <a className="lat-btn" href={viewReceipt} download="comprobante">⇓ Descargar</a>
              <button className="lat-btn ghost" onClick={() => setViewReceipt(null)}>Cerrar</button>
            </div>
        </ModalShell>
      )}
    </>
  );
}
