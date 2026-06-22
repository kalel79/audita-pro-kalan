import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { K } from '../lib/utils';

export default function Admin() {
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]       = useState('');
  const [guardando, setGuardando] = useState(null);

  const cargar = async () => {
    setCargando(true);
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, email, rol, estado, creado_en')
      .order('creado_en', { ascending: false });
    if (error) setError(error.message);
    setPerfiles(data || []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const cambiarEstado = async (id, estado) => {
    setGuardando(id);
    const { error } = await supabase
      .from('perfiles')
      .update({ estado })
      .eq('id', id);
    if (error) { setError(error.message); setGuardando(null); return; }
    setPerfiles(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    setGuardando(null);
  };

  const cambiarRol = async (id, rol) => {
    setGuardando(id);
    const { error } = await supabase
      .from('perfiles')
      .update({ rol })
      .eq('id', id);
    if (error) { setError(error.message); setGuardando(null); return; }
    setPerfiles(prev => prev.map(p => p.id === id ? { ...p, rol } : p));
    setGuardando(null);
  };

  if (cargando) return <p style={{ color: K.gris }}>Cargando usuarios…</p>;

  const pendientes  = perfiles.filter(p => p.estado === 'pendiente');
  const activos     = perfiles.filter(p => p.estado === 'activo');
  const bloqueados  = perfiles.filter(p => p.estado === 'bloqueado');

  return (
    <div>
      <h2 style={{ color: K.azul, marginBottom: 4 }}>Administración de usuarios</h2>
      <p style={{ color: K.gris, fontSize: 13, marginBottom: 20 }}>
        Aprueba, bloquea o ajusta el rol de los usuarios de Audita Pro.
      </p>
      {error && <div style={S.error}>{error}</div>}

      {/* ── Pendientes ── */}
      <h3 style={S.subtitulo}>⏳ Pendientes de aprobación ({pendientes.length})</h3>
      {pendientes.length === 0
        ? <p style={{ color: K.gris, fontSize: 13, marginBottom: 20 }}>No hay usuarios pendientes.</p>
        : pendientes.map(p => (
          <div key={p.id} style={S.fila}>
            <div>
              <strong>{p.nombre || '(sin nombre)'}</strong>
              <div style={{ fontSize: 12.5, color: K.gris }}>{p.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                style={S.select}
                defaultValue="consultor"
                onChange={e => cambiarRol(p.id, e.target.value)}
                disabled={guardando === p.id}>
                <option value="cliente">👤 Cliente</option>
                <option value="consultor">🔧 Consultor</option>
                <option value="admin">👑 Admin</option>
              </select>
              <button
                style={S.btnAprobar}
                disabled={guardando === p.id}
                onClick={() => cambiarEstado(p.id, 'activo')}>
                ✅ Aprobar
              </button>
              <button
                style={S.btnRevocar}
                disabled={guardando === p.id}
                onClick={() => cambiarEstado(p.id, 'bloqueado')}>
                🚫 Rechazar
              </button>
            </div>
          </div>
        ))
      }

      {/* ── Activos ── */}
      <h3 style={{ ...S.subtitulo, marginTop: 28 }}>✅ Usuarios activos ({activos.length})</h3>
      {activos.map(p => (
        <div key={p.id} style={S.fila}>
          <div>
            <strong>{p.nombre}</strong>
            {p.rol === 'admin'     && <span style={S.tagAdmin}>admin</span>}
            {p.rol === 'consultor' && <span style={S.tagConsultor}>consultor</span>}
            {p.rol === 'cliente'   && <span style={S.tagCliente}>cliente</span>}
            <div style={{ fontSize: 12.5, color: K.gris }}>{p.email}</div>
          </div>
          {p.rol !== 'admin' && (
            <button
              style={S.btnRevocar}
              disabled={guardando === p.id}
              onClick={() => cambiarEstado(p.id, 'bloqueado')}>
              🚫 Bloquear
            </button>
          )}
        </div>
      ))}

      {/* ── Bloqueados ── */}
      {bloqueados.length > 0 && <>
        <h3 style={{ ...S.subtitulo, marginTop: 28 }}>🚫 Bloqueados ({bloqueados.length})</h3>
        {bloqueados.map(p => (
          <div key={p.id} style={S.fila}>
            <div>
              <strong>{p.nombre || '(sin nombre)'}</strong>
              <div style={{ fontSize: 12.5, color: K.gris }}>{p.email}</div>
            </div>
            <button
              style={S.btnAprobar}
              disabled={guardando === p.id}
              onClick={() => cambiarEstado(p.id, 'activo')}>
              ↩ Reactivar
            </button>
          </div>
        ))}
      </>}
    </div>
  );
}

const S = {
  subtitulo: { fontSize: 14, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 },
  fila: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', border: '1px solid #E4E0D6', borderRadius: 10,
    padding: '10px 14px', marginBottom: 8, flexWrap: 'wrap', gap: 8,
  },
  select: {
    padding: '7px 10px', borderRadius: 8, border: '1px solid #DEE2E9',
    fontSize: 12, background: '#fff', cursor: 'pointer',
  },
  btnAprobar: {
    background: K.verde, color: '#fff', border: 'none', padding: '8px 16px',
    borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
  },
  btnRevocar: {
    background: K.rojo, color: '#fff', border: 'none', padding: '8px 16px',
    borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13,
  },
  tagAdmin:     { fontSize: 10.5, fontWeight: 700, color: K.azul,  background: '#D6E8F7', padding: '2px 7px', borderRadius: 6, marginLeft: 6 },
  tagConsultor: { fontSize: 10.5, fontWeight: 700, color: '#5E35B1', background: '#EDE7F6', padding: '2px 7px', borderRadius: 6, marginLeft: 6 },
  tagCliente:   { fontSize: 10.5, fontWeight: 700, color: '#444',  background: '#F5F7FA', padding: '2px 7px', borderRadius: 6, marginLeft: 6 },
  error: { background: '#FEE2E2', color: '#991B1B', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 12 },
};
