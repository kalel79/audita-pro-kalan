import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { K } from '../lib/utils';

export default function Admin() {
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, email, rol, aprobado, creado_en')
      .order('creado_en', { ascending: false });
    if (error) setError(error.message);
    setPerfiles(data || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const cambiarAprobacion = async (id, aprobado) => {
    const { error } = await supabase.from('perfiles').update({ aprobado }).eq('id', id);
    if (error) { setError(error.message); return; }
    setPerfiles((prev) => prev.map((p) => (p.id === id ? { ...p, aprobado } : p)));
  };

  if (cargando) return <p style={{ color: K.gris }}>Cargando usuarios…</p>;

  const pendientes = perfiles.filter((p) => !p.aprobado);
  const aprobados = perfiles.filter((p) => p.aprobado);

  return (
    <div>
      <h2 style={{ color: K.azul, marginBottom: 4 }}>Administración de usuarios</h2>
      <p style={{ color: K.gris, fontSize: 13, marginBottom: 20 }}>
        Aprueba a los consultores que pueden usar Audita Pro.
      </p>
      {error && <div style={S.error}>{error}</div>}

      <h3 style={S.subtitulo}>Pendientes de aprobación ({pendientes.length})</h3>
      {pendientes.length === 0 && <p style={{ color: K.gris, fontSize: 13 }}>No hay usuarios pendientes.</p>}
      {pendientes.map((p) => (
        <div key={p.id} style={S.fila}>
          <div>
            <strong>{p.nombre}</strong>
            <div style={{ fontSize: 12.5, color: K.gris }}>{p.email}</div>
          </div>
          <button style={S.btnAprobar} onClick={() => cambiarAprobacion(p.id, true)}>Aprobar</button>
        </div>
      ))}

      <h3 style={{ ...S.subtitulo, marginTop: 28 }}>Usuarios aprobados ({aprobados.length})</h3>
      {aprobados.map((p) => (
        <div key={p.id} style={S.fila}>
          <div>
            <strong>{p.nombre}</strong> {p.rol === 'admin' && <span style={S.tagAdmin}>admin</span>}
            <div style={{ fontSize: 12.5, color: K.gris }}>{p.email}</div>
          </div>
          {p.rol !== 'admin' && (
            <button style={S.btnRevocar} onClick={() => cambiarAprobacion(p.id, false)}>Revocar</button>
          )}
        </div>
      ))}
    </div>
  );
}

const S = {
  subtitulo: { fontSize: 14, fontWeight: 700, color: K.carbon, marginBottom: 8 },
  fila: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', border: '1px solid #E4E0D6', borderRadius: 10,
    padding: '10px 14px', marginBottom: 8,
  },
  btnAprobar: {
    background: K.verde, color: '#fff', border: 'none', padding: '8px 16px',
    borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
  },
  btnRevocar: {
    background: K.rojo, color: '#fff', border: 'none', padding: '8px 16px',
    borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
  },
  tagAdmin: {
    fontSize: 10.5, fontWeight: 700, color: K.azul, background: K.arena,
    padding: '2px 7px', borderRadius: 6, marginLeft: 6,
  },
  error: { background: '#FEE2E2', color: '#991B1B', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 },
};
