'use client';

// Contenedor de modales con portal a document.body.
// Los modales deben vivir fuera del árbol del layout: .shell crea un contexto
// de apilamiento (z-index) propio, y cualquier modal renderizado dentro queda
// por debajo de la barra de pestañas inferior en mobile.

import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';

export default function ModalShell({
  onClose,
  children,
  className = '',
  style,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${className}`.trim()} style={style} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
