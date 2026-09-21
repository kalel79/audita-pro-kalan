import React, { useEffect, useState } from 'react';
import { asegurarFotoLocal } from '../lib/fotos';
import { K } from '../lib/utils';

/**
 * Foto de un hallazgo. Usa la copia del dispositivo; si el hallazgo viene de
 * otro dispositivo y todavía no se descargó, la baja al mostrarse.
 */
export default function FotoHallazgo({ h, size = 76, radius = 8 }) {
  const [src, setSrc] = useState(h.foto || null);
  const [estado, setEstado] = useState(h.foto ? 'ok' : h.foto_path ? 'cargando' : 'sin');

  useEffect(() => {
    let vivo = true;
    if (h.foto) { setSrc(h.foto); setEstado('ok'); return; }
    if (!h.foto_path) { setEstado('sin'); return; }
    setEstado('cargando');
    asegurarFotoLocal(h)
      .then((f) => {
        if (!vivo) return;
        if (f) { setSrc(f); setEstado('ok'); } else setEstado('sinConexion');
      })
      .catch((e) => {
        console.error('No se pudo obtener la foto del hallazgo:', e);
        if (vivo) setEstado('error');
      });
    return () => { vivo = false; };
  }, [h.id, h.foto, h.foto_path]);

  if (estado === 'sin') return null;

  const caja = { width: size, height: size, borderRadius: radius, flexShrink: 0 };
  if (estado === 'ok') {
    return <img src={src} alt="Evidencia del hallazgo" style={{ ...caja, objectFit: 'cover' }} />;
  }
  const texto = {
    cargando: 'Cargando foto…',
    sinConexion: '📷 Foto disponible con internet',
    error: '📷 No se pudo cargar la foto',
  }[estado];
  return (
    <div style={{
      ...caja, background: K.arena, border: '1px dashed #DDD8CC', color: K.gris,
      fontSize: 10.5, fontWeight: 600, lineHeight: 1.3, textAlign: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, boxSizing: 'border-box',
    }}>
      {texto}
    </div>
  );
}
