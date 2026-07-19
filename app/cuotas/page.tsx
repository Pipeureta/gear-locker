'use client';

import { useRef, useState } from 'react';
import { fmtCLP, fmtMonth, PAYMENT_INFO } from '@/lib/data';
import { useCurrentPlayer, useStore } from '@/lib/store';
import { fileToDataUrl } from '@/lib/img';

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard no disponible */
    }
  };
  return (
    <div className="copy-row">
      <div>
        <div className="cr-label">{label}</div>
        <div className="cr-value">{value}</div>
      </div>
      <button className={`cr-btn${copied ? ' copied' : ''}`} onClick={copy}>
        {copied ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  );
}

export default function CuotasPage() {
  const player = useCurrentPlayer();
  const { dues, receipts, addReceipt } = useStore();
  const myDues = dues
    .filter((d) => d.playerId === player.id)
    .sort((a, b) => b.month.localeCompare(a.month));
  const pending = myDues.filter((d) => !d.paid);
  const totalPending = pending.reduce((s, x) => s + x.amount, 0);
  const myReceipts = receipts.filter((r) => r.playerId === player.id);

  const [month, setMonth] = useState('');
  const [upMsg, setUpMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allBankData = [
    `Titular: ${PAYMENT_INFO.holder}`,
    `RUT: ${PAYMENT_INFO.rut}`,
    `${PAYMENT_INFO.accountType} — ${PAYMENT_INFO.bank}`,
    `Correo: ${PAYMENT_INFO.email}`,
    `Asunto: ${PAYMENT_INFO.subject}`,
  ].join('\n');

  const uploadReceipt = async (f: File | undefined) => {
    if (!f) return;
    const m = month || pending[0]?.month;
    if (!m) {
      setUpMsg('No tienes meses pendientes que respaldar.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(f, 1200);
      addReceipt(player.id, m, f.name, dataUrl);
      setUpMsg(`Comprobante de ${fmtMonth(m)} enviado. Comandancia lo revisará y marcará tu cuota como pagada.`);
    } catch (err) {
      setUpMsg(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    }
  };

  return (
    <>
      <p className="page-intro">
        Aquí ves tus cuotas, los datos para transferir y puedes adjuntar el comprobante para que comandancia lo revise.
      </p>

      <div className="grid cols-3">
        <div className="lat-panel">
          <div className="panel-head"><h3>Estado</h3></div>
          <div className={`big-num ${pending.length === 0 ? 'ok' : 'crit'}`}>
            {pending.length === 0 ? 'AL DÍA' : 'DEUDA'}
          </div>
          <span className="help">
            {pending.length === 0
              ? 'Todas tus cuotas están pagadas.'
              : `${pending.length} ${pending.length === 1 ? 'mes pendiente' : 'meses pendientes'}: ${pending.map((d) => fmtMonth(d.month).split(' ')[0]).join(', ')}.`}
          </span>
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>Total pendiente</h3></div>
          <div className={`big-num ${totalPending === 0 ? 'ok' : 'crit'}`} style={{ fontSize: 28 }}>
            {fmtCLP(totalPending)}
          </div>
          <span className="help">La cuota mensual es de {fmtCLP(10000)}.</span>
        </div>
        <div className="lat-panel">
          <div className="panel-head"><h3>Paso a paso</h3></div>
          <span className="help">
            1. Transfiere a la cuenta de al lado (usa los botones Copiar).<br />
            2. Envía el comprobante al correo con el asunto indicado.<br />
            3. Adjunta el comprobante aquí abajo para dejar respaldo en la app.<br />
            4. {PAYMENT_INFO.note}
          </span>
        </div>
      </div>

      <div className="grid cols-2" style={{ marginTop: 14 }}>
        <div className="lat-panel">
          <div className="panel-head">
            <h3>Datos para transferir</h3>
            <button
              className="lat-btn ghost sm"
              onClick={() => navigator.clipboard?.writeText(allBankData).catch(() => {})}
            >
              Copiar todo
            </button>
          </div>
          <CopyRow label="Titular" value={PAYMENT_INFO.holder} />
          <CopyRow label="RUT" value={PAYMENT_INFO.rut} />
          <CopyRow label="Banco / Cuenta" value={`${PAYMENT_INFO.bank} — ${PAYMENT_INFO.accountType}`} />
          <CopyRow label="Correo para comprobante" value={PAYMENT_INFO.email} />
          <CopyRow label="Asunto del correo" value={PAYMENT_INFO.subject} />
          <span className="help warnc">{PAYMENT_INFO.note}</span>
        </div>

        <div className="lat-panel">
          <div className="panel-head"><h3>Adjuntar comprobante</h3></div>
          {pending.length === 0 ? (
            <div className="empty-state">Estás al día — no hay nada que respaldar. 🎯</div>
          ) : (
            <>
              <div className="lat-field">
                <label>¿De qué mes es el pago?</label>
                <select className="lat-select" value={month || pending[0]?.month} onChange={(e) => setMonth(e.target.value)}>
                  {pending.map((d) => (
                    <option key={d.month} value={d.month}>{fmtMonth(d.month)}</option>
                  ))}
                </select>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => { uploadReceipt(e.target.files?.[0]); e.target.value = ''; }}
              />
              <button className="lat-btn primary" onClick={() => fileRef.current?.click()}>
                ⇪ Subir comprobante (foto o PDF)
              </button>
              {upMsg && <div className="lat-alert ok"><span className="help">{upMsg}</span></div>}
            </>
          )}
          {myReceipts.length > 0 && (
            <>
              <div className="tiny dim-t" style={{ marginTop: 6 }}>Mis comprobantes</div>
              {myReceipts.map((r) => (
                <div key={r.id} className="row between small">
                  <span className="mut">{fmtMonth(r.month)} · {r.filename}</span>
                  <span className={r.status === 'aceptado' ? 'okc' : 'warnc'}>
                    {r.status === 'aceptado' ? '✓ ACEPTADO' : 'EN REVISIÓN'}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="section-title">Mi historial</div>
      <div className="lat-panel">
        <div className="table-scroll">
          <table className="lat-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Fecha de pago</th>
              </tr>
            </thead>
            <tbody>
              {myDues.map((x) => (
                <tr key={x.month}>
                  <td>{fmtMonth(x.month)}</td>
                  <td className="mono-dim">{fmtCLP(x.amount)}</td>
                  <td className={x.paid ? 'badge-ok' : 'badge-crit'}>
                    {x.paid ? '● PAGADA' : '○ PENDIENTE'}
                  </td>
                  <td className="mono-dim">{x.paidAt ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
