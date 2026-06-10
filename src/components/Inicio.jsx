import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, eliminarAuditoria } from '../lib/db';
import { K, COLOR_CAT, calcCumplimiento, dictamen } from '../lib/utils';
import Logo from './Logo';
import Donut from './Donut';

export default function Inicio() {
  const navigate = useNavigate();
  const auditorias = useLiveQuery(() => db.auditorias.orderBy('fecha').reverse().toArray()) || [];

  const stats = useMemo(() => {
    const total = auditorias.length;
    const cerradas = auditorias.filter((a) => a.cerrada).length;
    let aprobadas = 0, riesgo = 0;
    auditorias.forEach((a) => {
      const { pct, criticosFallidos, total: t } = calcCumplimiento(a.checklist || []);
      if (t > 0 && pct >= 90 && criticosFallidos === 0) aprobadas++;
      if (t > 0 && (pct < 70 || criticosFallidos > 0)) riesgo++;
    });
    return { total, cerradas, abiertas: total - cerradas, aprobadas, riesgo };
  }, [auditorias]);

  const borrar = async (id) => {
    if (confirm('¿Eliminar esta auditoría? Esta acción no se puede deshacer.')) {
      await eliminarAuditoria(id);
    }
  };

  return (
    <div className="apk-fade">
      <div style={S.hero}>
        <div>
          <h1 style={S.titulo}>Panel de Auditorías</h1>
          <p style={S.sub}>30 giros COFEPRIS · 851 criterios técnicos · Funciona sin conexión</p>
        </div>
        <button style={S.btnPrimary} onClick={() => navigate('/nueva')}>+ Nueva auditoría</button>
      </div>

      <div style={S.stats}>
        <Stat n={stats.total} l="Auditorías totales" c={K.azul} />
        <Stat n={stats.abiertas} l="En proceso" c={K.azulCl} />
        <Stat n={stats.aprobadas} l="Aprobadas" c={K.verde} />
        <Stat n={stats.riesgo} l="En riesgo" c={K.rojo} />
      </div>

      {auditorias.length === 0 ? (
        <div style={S.empty}>
          <Logo size={80} />
          <p style={S.emptyTit}>Aún no hay auditorías registradas</p>
          <p style={S.emptySub}>
            Crea la primera auditoría. Elige un giro del catálogo Kalan y carga automáticamente
            el checklist normativo correspondiente.
          </p>
          <button style={{ ...S.btnPrimary, marginTop: 22 }} onClick={() => navigate('/nueva')}>
            + Crear primera auditoría
          </button>
        </div>
      ) : (
        <div style={S.grid}>
          {auditorias.map((a) => {
            const { pct, criticosFallidos, total } = calcCumplimiento(a.checklist || []);
            const d = dictamen(pct, criticosFallidos, total);
            const cat = COLOR_CAT[a.categoria] || K.azul;
            return (
              <div key={a.id} style={S.card} className="apk-card">
                <div style={{ ...S.catBar, background: cat }} />
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={S.cardTit}>{a.establecimiento || 'Sin nombre'}</div>
                    <span style={{ ...S.pill, background: cat + '1A', color: cat }}>{a.categoria}</span>
                  </div>
                  <div style={S.cardGiro}>{a.giro}</div>
                  <div style={S.cardMeta}>
                    {a.tramite} · {a.fecha}
                    {a.dirty && <span style={S.dirtyTag}>● Sin sincronizar</span>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                    <Donut pct={pct} color={d.color} size={52} />
                    <div>
                      <div style={{ fontWeight: 800, color: d.color, fontSize: 11, letterSpacing: 0.3, lineHeight: 1.2 }}>{d.label}</div>
                      <div style={{ fontSize: 11, color: K.gris, marginTop: 2 }}>{a.cerrada ? 'Cerrada' : 'En proceso'}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button style={S.btnGhost} onClick={() => navigate(`/auditoria/${a.id}`)}>Abrir</button>
                    <button style={S.btnGhost} onClick={() => navigate(`/reporte/${a.id}`)}>Dictamen</button>
                    <button style={S.btnDanger} onClick={() => borrar(a.id)}>✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ n, l, c }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', boxShadow: '0 2px 12px rgba(0,0,0,.05)', borderTop: `3px solid ${c}` }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: c, lineHeight: 1.1 }}>{n}</div>
      <div style={{ fontSize: 12, color: K.gris, marginTop: 2 }}>{l}</div>
    </div>
  );
}

const S = {
  hero: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 22 },
  titulo: { fontSize: 28, fontWeight: 800, color: K.azul, margin: 0 },
  sub: { color: K.gris, margin: '4px 0 0', fontSize: 13.5 },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 26 },
  empty: { background: '#fff', borderRadius: 18, padding: '56px 24px', textAlign: 'center', boxShadow: '0 2px 14px rgba(0,0,0,.05)' },
  emptyTit: { marginTop: 20, fontWeight: 700, color: K.azul, fontSize: 17 },
  emptySub: { color: K.gris, fontSize: 14, maxWidth: 460, margin: '8px auto 0', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  card: { background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 14px rgba(0,0,0,.06)' },
  catBar: { height: 5 },
  cardTit: { fontWeight: 700, color: K.carbon, fontSize: 15, lineHeight: 1.25 },
  cardGiro: { fontSize: 12.5, color: K.gris, marginTop: 4, lineHeight: 1.4 },
  cardMeta: { fontSize: 11.5, color: K.gris, marginTop: 8, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  dirtyTag: { color: K.amber, fontWeight: 700 },
  pill: { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap' },
  btnPrimary: { background: `linear-gradient(120deg, ${K.verde}, ${K.verdeCl})`, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 3px 12px rgba(21,128,61,.3)' },
  btnGhost: { background: '#fff', color: K.azul, border: `1.5px solid ${K.azul}33`, padding: '7px 12px', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', flex: 1 },
  btnDanger: { background: '#fff', color: K.rojo, border: `1.5px solid ${K.rojo}33`, padding: '7px 11px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' },
};
