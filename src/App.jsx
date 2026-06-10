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

export default function App() {
  const [sesion, setSesion] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSesion(session);
      setCargando(false);
      if (session) sincronizar();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSesion(session);
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

  return (
    <div style={S.app}>
      <Header usuario={usuario} />
      <main style={S.main} className="safe-bottom">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/nueva" element={<NuevaAuditoria usuario={usuario} />} />
          <Route path="/auditoria/:id" element={<Auditoria />} />
          <Route path="/reporte/:id" element={<Reporte />} />
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
