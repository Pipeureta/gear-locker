'use client';

// Cuenta regresiva en vivo hacia el próximo evento confirmado por el usuario.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fmtDate, type GameEvent } from '@/lib/data';

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function DeploymentCountdown({ event }: { event: GameEvent }) {
  // Solo se calcula tras montar, para evitar diferencias entre servidor y cliente.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = new Date(`${event.date}T${event.startTime}:00`).getTime();
  const ms = now === null ? null : target - now;

  let display: React.ReactNode;
  if (ms === null) {
    display = <span className="big-num" style={{ fontSize: 30 }}>—</span>;
  } else if (ms <= 0) {
    display = <span className="big-num ok" style={{ fontSize: 30 }}>EN CURSO</span>;
  } else {
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    display = (
      <span className="big-num" style={{ fontSize: 34 }}>
        {days}
        <span className="unit">d</span> {pad(hours)}:{pad(mins)}:{pad(secs)}
      </span>
    );
  }

  return (
    <div className="lat-panel" style={{ borderColor: 'var(--border-hi)' }}>
      <div className="panel-head">
        <h3>◎ Próximo despliegue en</h3>
        <span className="lat-chip ok"><span className="dot" /> Confirmado</span>
      </div>
      {display}
      <div className="kv"><span className="k">Operación</span><span className="v accent">{event.name}</span></div>
      <div className="kv"><span className="k">Cuándo</span><span className="v">{fmtDate(event.date)} · {event.startTime} HRS</span></div>
      <div className="kv"><span className="k">Dónde</span><span className="v">{event.location}</span></div>
      <Link href={`/eventos/${event.id}`} className="lat-btn sm">◎ Ver briefing</Link>
    </div>
  );
}
