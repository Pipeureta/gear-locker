'use client';

import { useState } from 'react';
import type { InventoryItem, Procurement } from '@/lib/data';
import { useStore } from '@/lib/store';

const EMPTY_ITEM: InventoryItem = { name: '', qty: 1, holder: 'Bodega' };
const EMPTY_PROCUREMENT: Procurement = { item: '', status: 'Pendiente' };
const PROCUREMENT_STATUSES: Procurement['status'][] = ['Pendiente', 'Evaluando', 'Hecho'];

export default function InventoryPanel() {
  const {
    inventory,
    addInventoryItem,
    updateInventoryItem,
    removeInventoryItem,
    procurements,
    addProcurement,
    updateProcurement,
    removeProcurement,
  } = useStore();

  const [itemEditor, setItemEditor] = useState<InventoryItem | null>(null);
  const [originalItemName, setOriginalItemName] = useState<string | null>(null);
  const [itemMsg, setItemMsg] = useState<string | null>(null);
  const [procurementDraft, setProcurementDraft] = useState<Procurement>(EMPTY_PROCUREMENT);

  const totalItems = inventory.reduce((sum, item) => sum + item.qty, 0);
  const outside = inventory.filter((item) => item.holder !== 'Bodega' && item.holder !== '—');
  const holders = [...new Set(outside.map((item) => item.holder))];

  const openNewItem = () => {
    setOriginalItemName(null);
    setItemEditor({ ...EMPTY_ITEM });
    setItemMsg(null);
  };

  const saveItem = () => {
    if (!itemEditor) return;
    if (!itemEditor.name.trim() || !itemEditor.holder.trim() || itemEditor.qty < 1) {
      setItemMsg('Artículo, cantidad y ubicación son obligatorios.');
      return;
    }
    const normalized: InventoryItem = {
      name: itemEditor.name.trim(),
      qty: Math.max(1, Math.round(itemEditor.qty)),
      holder: itemEditor.holder.trim(),
      note: itemEditor.note?.trim() || undefined,
    };
    const duplicate = inventory.some(
      (item) => item.name.toLowerCase() === normalized.name.toLowerCase() && item.name !== originalItemName,
    );
    if (duplicate) {
      setItemMsg('Ya existe un artículo con ese nombre.');
      return;
    }
    if (originalItemName) updateInventoryItem(originalItemName, normalized);
    else addInventoryItem(normalized);
    setItemEditor(null);
  };

  const addNewProcurement = () => {
    if (!procurementDraft.item.trim()) return;
    if (procurements.some((item) => item.item.toLowerCase() === procurementDraft.item.trim().toLowerCase())) return;
    addProcurement({ ...procurementDraft, item: procurementDraft.item.trim() });
    setProcurementDraft({ ...EMPTY_PROCUREMENT });
  };

  return (
    <>
      <div className="grid cols-3">
        <div className="lat-panel">
          <div className="panel-head"><h3>Artículos</h3></div>
          <div className="big-num">{inventory.length}</div>
          <span className="tiny mut">{totalItems} unidades en total</span>
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>Fuera de bodega</h3></div>
          <div className="big-num warn">{outside.length}</div>
          <span className="tiny mut">{holders.length ? `Con: ${holders.join(', ')}` : 'Todo está en bodega'}</span>
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>Adquisiciones</h3></div>
          <div className="big-num">{procurements.filter((item) => item.status !== 'Hecho').length}</div>
          <span className="tiny mut">Pendientes o en evaluación</span>
        </div>
      </div>

      <div className="section-title">Adquisiciones y cotizaciones</div>
      <div className="lat-panel">
        <div className="inventory-add-row">
          <input
            className="lat-input"
            value={procurementDraft.item}
            onChange={(e) => setProcurementDraft((prev) => ({ ...prev, item: e.target.value }))}
            placeholder="Nueva adquisición o cotización"
          />
          <select
            className="lat-select"
            value={procurementDraft.status}
            onChange={(e) => setProcurementDraft((prev) => ({ ...prev, status: e.target.value as Procurement['status'] }))}
          >
            {PROCUREMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
          <button className="lat-btn primary" onClick={addNewProcurement}>Agregar</button>
        </div>
        {procurements.length === 0 && <div className="empty-state">No hay adquisiciones registradas.</div>}
        {procurements.map((procurement) => (
          <div key={procurement.item} className="inventory-procurement-row">
            <span>{procurement.item}</span>
            <select
              className="lat-select"
              value={procurement.status}
              aria-label={`Estado de ${procurement.item}`}
              onChange={(e) =>
                updateProcurement(procurement.item, {
                  ...procurement,
                  status: e.target.value as Procurement['status'],
                })
              }
            >
              {PROCUREMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
            <button className="lat-btn danger sm" onClick={() => removeProcurement(procurement.item)}>Eliminar</button>
          </div>
        ))}
      </div>

      <div className="section-title row between">
        <span>Equipo del team</span>
        <button className="lat-btn primary sm" onClick={openNewItem}>+ Agregar artículo</button>
      </div>
      <div className="lat-panel">
        <div className="table-scroll">
          <table className="lat-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th>Cant.</th>
                <th>Ubicación</th>
                <th>Notas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td className="mono-dim">{item.qty}</td>
                  <td className={item.holder === 'Bodega' ? 'badge-ok' : item.holder === '—' ? 'mono-dim' : 'badge-warn'}>
                    {item.holder.toUpperCase()}
                  </td>
                  <td className="mono-dim">{item.note ?? '—'}</td>
                  <td>
                    <span className="row inventory-actions">
                      <button
                        className="lat-btn ghost sm"
                        onClick={() => {
                          setOriginalItemName(item.name);
                          setItemEditor({ ...item });
                          setItemMsg(null);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="lat-btn danger sm"
                        onClick={() => {
                          if (confirm(`¿Eliminar “${item.name}” del inventario?`)) removeInventoryItem(item.name);
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
        <span className="tiny dim-t">Los cambios quedan disponibles para todos los usuarios de Comandancia.</span>
      </div>

      {itemEditor && (
        <div className="modal-overlay" onClick={() => setItemEditor(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{originalItemName ? 'Editar artículo' : 'Agregar artículo'}</h2>
            <div className="lat-field">
              <label>Artículo</label>
              <input className="lat-input" value={itemEditor.name} onChange={(e) => setItemEditor((prev) => prev && ({ ...prev, name: e.target.value }))} />
            </div>
            <div className="grid cols-2 compact-grid">
              <div className="lat-field">
                <label>Cantidad</label>
                <input className="lat-input" type="number" min="1" value={itemEditor.qty} onChange={(e) => setItemEditor((prev) => prev && ({ ...prev, qty: Number(e.target.value) }))} />
              </div>
              <div className="lat-field">
                <label>Ubicación o responsable</label>
                <input className="lat-input" value={itemEditor.holder} onChange={(e) => setItemEditor((prev) => prev && ({ ...prev, holder: e.target.value }))} placeholder="Bodega o integrante" />
              </div>
            </div>
            <div className="lat-field">
              <label>Notas</label>
              <textarea className="lat-textarea" rows={3} value={itemEditor.note ?? ''} onChange={(e) => setItemEditor((prev) => prev && ({ ...prev, note: e.target.value }))} placeholder="Estado, préstamo u observaciones" />
            </div>
            {itemMsg && <div className="lat-alert warn">{itemMsg}</div>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="lat-btn ghost" onClick={() => setItemEditor(null)}>Cancelar</button>
              <button className="lat-btn primary" onClick={saveItem}>Guardar artículo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}