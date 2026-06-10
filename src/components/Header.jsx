import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { sincronizar } from '../lib/sync';
import { contarPendientes } from '../lib/db';
import { K } from '../lib/utils';
import Logo from './Logo';

export default function Header({ usuario }) {
  const navigate = useNavigate();
  const [online, setOnline] = useState(navigator.onLine);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    const refresh = async () => setPendientes(await contarPendientes());
    refresh();
    const interval = setInterval(refresh, 4000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(interval);
    };
  }, []);

  const sync = async () => {
    if (!online) {
      alert('Necesitas conexión a internet para sincronizar.');
      return;
    }
    setSincronizando(true);
    const res = await sincronizar();
    setSincronizando(false);
    setPendientes(await contarPendientes());
    if (!res.ok) alert('Error: ' + res.mensaje);
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <header style={S.header} className="safe-top">
      <div style={S.inner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => navigate('/')}>
          <Logo size={44} white />
          <div style={{ minWidth: 0 }}>
            <div style={S.brand}>AUDITA <span style={{ color: K.verdeBr }}>PRO</span></div>
            <div style={S.brandSub}>KALAN · #KalanProtege</div>
          </div>
        </div>

        <div style={S.actions}>
          <div title={online ? 'En línea' : 'Sin conexión'} style={{
            ...S.statusDot,
            background: online ? '#4ADE80' : '#FCA5A5',
            boxShadow: online ? '0 0 10px #4ADE80' : 'none',
          }} />

          <button
            onClick={sync}
            disabled={sincronizando}
            style={{ ...S.iconBtn, position: 'relative' }}
            title={`Sincronizar (${pendientes} pendientes)`}
          >
            <span style={{ display: 'inline-block', animation: sincronizando ? 'apkSpin 1s linear infinite' : 'none' }}>⟳</span>
            {pendientes > 0 && <span style={S.badge}>{pendientes}</span>}
          </button>

          <button onClick={() => setMenuAbierto(!menuAbierto)} style={S.iconBtn} title="Menú">
            ☰
          </button>
        </div>
      </div>

      {menuAbierto && (
        <div style={S.menu} onClick={() => setMenuAbierto(false)}>
          <div style={S.menuItem}>
            <div style={{ fontSize: 11, opacity: 0.7 }}>Sesión iniciada como</div>
            <strong>{usuario?.email}</strong>
          </div>
          <button onClick={cerrarSesion} style={S.menuBtn}>Cerrar sesión</button>
        </div>
      )}
    </header>
  );
}

const S = {
  header: {
    background: `linear-gradient(120deg, ${K.azul} 0%, ${K.azulCl} 50%, ${K.verde} 100%)`,
    color: '#fff',
    boxShadow: '0 4px 20px rgba(11,60,93,.25)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  inner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  brand: { fontWeight: 800, fontSize: 19, letterSpacing: 0.8, lineHeight: 1, whiteSpace: 'nowrap' },
  brandSub: { fontSize: 10, opacity: 0.9, letterSpacing: 0.4, marginTop: 2, fontWeight: 600 },
  actions: { display: 'flex', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: '50%', transition: 'all .3s' },
  iconBtn: {
    background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.2)',
    color: '#fff', width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
    fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4, background: '#EF4444', color: '#fff',
    fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, borderRadius: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
  },
  menu: {
    position: 'absolute', top: '100%', right: 18, background: '#fff', color: K.carbon,
    borderRadius: 12, padding: 14, minWidth: 220, boxShadow: '0 8px 30px rgba(0,0,0,.2)',
    marginTop: 6,
  },
  menuItem: { padding: '8px 10px', fontSize: 13, color: K.gris, borderBottom: '1px solid #E4E0D6', marginBottom: 8 },
  menuBtn: {
    background: K.rojo, color: '#fff', border: 'none', padding: '10px 14px',
    borderRadius: 8, fontWeight: 700, cursor: 'pointer', width: '100%', fontSize: 13.5,
  },
};
