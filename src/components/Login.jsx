import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { K } from '../lib/utils';
import Logo from './Logo';

export default function Login() {
  const [modo, setModo] = useState('login'); // 'login' o 'registro'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  const enviar = async (e) => {
    e.preventDefault();
    setError(''); setMensaje(''); setCargando(true);

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nombre: nombre || email.split('@')[0] } },
        });
        if (error) throw error;
        setMensaje('Cuenta creada. Revisa tu correo para confirmar.');
      }
    } catch (e) {
      setError(e.message || 'Error de autenticación');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={S.wrap}>
      <div style={S.card} className="apk-fade">
        <div style={S.head}>
          <Logo size={72} />
          <h1 style={S.titulo}>AUDITA <span style={{ color: K.verdeBr }}>PRO</span></h1>
          <p style={S.sub}>Kalan Consulting · Consultoría Sanitaria</p>
        </div>

        <div style={S.tabs}>
          <button
            onClick={() => { setModo('login'); setError(''); setMensaje(''); }}
            style={modo === 'login' ? S.tabActive : S.tab}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => { setModo('registro'); setError(''); setMensaje(''); }}
            style={modo === 'registro' ? S.tabActive : S.tab}
          >
            Crear cuenta
          </button>
        </div>

        <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {modo === 'registro' && (
            <div>
              <label style={S.lbl}>Nombre completo</label>
              <input
                type="text"
                style={S.input}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Hugo Montiel Robles"
                required
              />
            </div>
          )}
          <div>
            <label style={S.lbl}>Correo</label>
            <input
              type="email"
              style={S.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="consultor@kalanconsulting.mx"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label style={S.lbl}>Contraseña</label>
            <input
              type="password"
              style={S.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <div style={S.error}>{error}</div>}
          {mensaje && <div style={S.ok}>{mensaje}</div>}

          <button type="submit" disabled={cargando} style={{ ...S.btn, opacity: cargando ? 0.6 : 1 }}>
            {cargando ? 'Procesando…' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <div style={S.footer}>
          <strong>#KalanProtege</strong> · Apizaco, Tlaxcala
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: {
    minHeight: '100dvh',
    background: `linear-gradient(135deg, ${K.azul} 0%, ${K.verde} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 18,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 420,
    boxShadow: '0 20px 60px rgba(0,0,0,.3)',
  },
  head: { textAlign: 'center', marginBottom: 24 },
  titulo: { fontSize: 28, fontWeight: 800, color: K.azul, margin: '12px 0 4px', letterSpacing: 1 },
  sub: { fontSize: 12.5, color: K.gris, margin: 0, fontWeight: 600 },
  tabs: { display: 'flex', gap: 4, background: K.arena, padding: 4, borderRadius: 10, marginBottom: 20 },
  tab: {
    flex: 1, background: 'transparent', border: 'none', padding: '9px 14px',
    borderRadius: 7, fontWeight: 600, color: K.gris, cursor: 'pointer', fontSize: 13.5,
  },
  tabActive: {
    flex: 1, background: '#fff', border: 'none', padding: '9px 14px',
    borderRadius: 7, fontWeight: 700, color: K.azul, cursor: 'pointer', fontSize: 13.5,
    boxShadow: '0 1px 4px rgba(0,0,0,.08)',
  },
  lbl: { display: 'block', fontSize: 12.5, fontWeight: 700, color: K.gris, marginBottom: 5, letterSpacing: 0.3 },
  input: {
    width: '100%', padding: '11px 13px', borderRadius: 9, border: '1.5px solid #DDD8CC',
    fontSize: 14.5, background: '#FCFBF8', outline: 'none', boxSizing: 'border-box', color: K.carbon,
  },
  btn: {
    background: `linear-gradient(120deg, ${K.verde}, ${K.verdeCl})`,
    color: '#fff', border: 'none', padding: '13px 22px',
    borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(21,128,61,.3)', marginTop: 6,
  },
  error: { background: '#FEE2E2', color: '#991B1B', padding: '10px 12px', borderRadius: 8, fontSize: 13 },
  ok: { background: '#DCFCE7', color: '#166534', padding: '10px 12px', borderRadius: 8, fontSize: 13 },
  footer: { textAlign: 'center', fontSize: 11, color: K.gris, marginTop: 24, fontWeight: 600 },
};
