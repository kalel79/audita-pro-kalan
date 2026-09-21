import React, { useEffect, useState } from 'react';
import { alHaberNuevaVersion, aplicarActualizacion } from '../lib/actualizacion';
import { K } from '../lib/utils';

/** Aviso de versión nueva. Nunca recarga solo: espera a que el usuario lo pida. */
export default function AvisoActualizacion() {
  const [visible, setVisible] = useState(false);
  const [estado, setEstado] = useState('listo'); // listo | aplicando | error

  useEffect(() => alHaberNuevaVersion(() => setVisible(true)), []);

  if (!visible) return null;

  const actualizar = async () => {
    setEstado('aplicando');
    const ok = await aplicarActualizacion();
    // Si salió bien la página se recarga; si no, se avisa y no se toca nada.
    if (!ok) setEstado('error');
  };

  return (
    <div role="status" style={S.caja} className="no-print">
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 700 }}>Nueva versión disponible</div>
        <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 2 }}>
          {estado === 'error'
            ? 'No se pudo guardar lo que tienes en pantalla. Revisa el aviso de guardado y vuelve a intentar.'
            : 'Lo que tengas abierto se guarda antes de actualizar.'}
        </div>
      </div>
      <button style={S.btn} onClick={actualizar} disabled={estado === 'aplicando'}>
        {estado === 'aplicando' ? 'Guardando…' : 'Actualizar'}
      </button>
      <button style={S.despues} onClick={() => setVisible(false)} disabled={estado === 'aplicando'}>Después</button>
    </div>
  );
}

const S = {
  caja: {
    position: 'fixed', left: 12, right: 12, bottom: 16, zIndex: 300, maxWidth: 560, margin: '0 auto',
    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
    background: K.azul, color: '#fff', borderRadius: 14, padding: '12px 16px',
    boxShadow: '0 8px 30px rgba(0,0,0,.3)',
  },
  btn: { background: K.verdeCl, color: '#fff', border: 'none', padding: '9px 18px', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  despues: { background: 'none', border: 'none', color: '#fff', opacity: 0.8, fontSize: 13, cursor: 'pointer', padding: '9px 4px' },
};
