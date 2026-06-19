import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { iniciarAutoSync, sincronizar } from './lib/sync';
import { K } from './lib/utils';
import Login from './components/Login';
import Header from './components/Header';
import Inicio from './components/Inicio';
import NuevaAuditoria from './components/NuevaAuditoria';
import Auditoria from './components/Auditoria';
import Reporte from './components/Reporte';
import Admin from './components/Admin';

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargarPerfil = async (session) => {
    if (!session) { setPerfil(null); return; }
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, aprobado')
      .eq('id', session.user.id)
      .maybeSingle();
    setPerfil(data || null);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSesion(session);
      await cargarPerfil(session);
      setCargando(false);
      if (session) sincronizar();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
      cargarPerfil(session);
      if (session) sincronizar();
    });

    const unsub = iniciarAutoSync((res) => {
      if (res?.ok) console.log('Auto-sync:', res.mensaje);
    });

    return () => {
      subscription.unsubscribe();
      unsub();
    };
  }, []);

  if (cargando) {
    return (
      <div style={S.cargando}>
        <div className="apk-spin" />
        <span style={{ marginTop: 16, color: K.gris }}>Cargando…</span>
      </div>
    );
  }

  if (!sesion) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  const usuario = sesion.user;

  if (perfil && !perfil.aprobado && perfil.rol !== 'admin') {
    return (
      <div style={S.cargando}>
        <h2 style={{ color: K.azul, marginBottom: 8 }}>Cuenta pendiente de aprobación</h2>
        <p style={{ color: K.gris, maxWidth: 360, textAlign: 'center' }}>
          Tu cuenta ({usuario.email}) fue creada correctamente, pero un administrador de Kalan Consulting
          debe aprobarla antes de que puedas usar Audita Pro.
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          style={{ marginTop: 18, background: K.azul, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <Header usuario={usuario} perfil={perfil} />
      <main style={S.main} className="safe-bottom">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/nueva" element={<NuevaAuditoria usuario={usuario} />} />
          <Route path="/auditoria/:id" element={<Auditoria />} />
          <Route path="/reporte/:id" element={<Reporte />} />
          {perfil?.rol === 'admin' && <Route path="/admin" element={<Admin />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

const S = {
  app: { minHeight: '100dvh' },
  cargando: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: K.arena,
  },
  main: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 18px 60px',
  },
};
