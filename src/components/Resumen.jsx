import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { K, calcCumplimiento } from '../lib/utils';
import Logo from './Logo';
import Donut from './Donut';

/**
 * Resumen para el auditor: la calificación que puede comunicar al cliente.
 * No incluye el dictamen (APROBADO / RIESGO), las acciones correctivas ni el
 * informe de hallazgos; esos los emite el admin.
 */
export default function Resumen({ aud }) {
  const navigate = useNavigate();
  const stats = useMemo(() => calcCumplimiento(aud.checklist || []), [aud]);

  const conteo = useMemo(() => {
    let no = 0, proceso = 0, pend = 0;
    (aud.checklist || []).forEach((s) => s.i.forEach((it) => {
      if (it.e === 'no') no++;
      else if (it.e === 'proceso') proceso++;
      else if (it.e === 'pend') pend++;
    }));
    return { no, proceso, pend };
  }, [aud]);

  const secciones = useMemo(() => (aud.checklist || []).map((s) => {
    let evaluados = 0, suma = 0, cumple = 0, proceso = 0, no = 0;
    s.i.forEach((it) => {
      if (it.e === 'cumple') { cumple++; evaluados++; suma += 1; }
      else if (it.e === 'proceso') { proceso++; evaluados++; suma += 0.5; }
      else if (it.e === 'no') { no++; evaluados++; }
    });
    return { s: s.s, total: s.i.length, evaluados, cumple, proceso, no, pct: evaluados ? Math.round((suma / evaluados) * 100) : null };
  }), [aud]);

  return (
    <div className="apk-fade">
      <button style={S.back} onClick={() => navigate(`/auditoria/${aud.id}`)}>← Volver a la auditoría</button>

      <div style={S.doc}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <Logo size={52} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: K.verde }}>RESUMEN DE EVALUACIÓN</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: K.azul, lineHeight: 1.25 }}>{aud.establecimiento}</div>
            <div style={{ fontSize: 12.5, color: K.gris, marginTop: 2 }}>{aud.giro} · Folio {aud.folio} · {aud.fecha}</div>
          </div>
        </div>

        <div style={S.calif}>
          <Donut pct={stats.pct} color={K.azul} size={112} bold />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 12, color: K.gris, letterSpacing: 1, fontWeight: 700 }}>CALIFICACIÓN DE CUMPLIMIENTO</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: K.azul, lineHeight: 1.1, margin: '4px 0' }}>{stats.pct}%</div>
            <div style={{ fontSize: 13, color: K.carbon }}>
              {stats.total} reactivos evaluados · <strong style={{ color: K.rojo }}>{conteo.no} no cumplen</strong> · <strong style={{ color: K.amber }}>{conteo.proceso} en proceso</strong>
            </div>
            {conteo.pend > 0 && (
              <div style={{ fontSize: 12, color: K.gris, marginTop: 4 }}>{conteo.pend} reactivos sin evaluar todavía.</div>
            )}
          </div>
        </div>

        <div style={S.aviso}>
          El dictamen técnico y las acciones correctivas los emite Kalan Consulting por separado.
          Esta calificación es preliminar y no constituye dictamen.
        </div>

        <div style={{ marginTop: 22, overflowX: 'auto' }}>
          <div style={S.secTit}>Avance por sección</div>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Sección</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Evaluados</th>
              <th style={{ ...S.th, textAlign: 'center' }}>✔</th>
              <th style={{ ...S.th, textAlign: 'center' }}>⚠</th>
              <th style={{ ...S.th, textAlign: 'center' }}>✕</th>
              <th style={{ ...S.th, textAlign: 'center' }}>%</th>
            </tr></thead>
            <tbody>
              {secciones.map((x, i) => (
                <tr key={i}>
                  <td style={S.td}><strong>{x.s}</strong></td>
                  <td style={{ ...S.td, textAlign: 'center' }}>{x.evaluados}/{x.total}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.verde, fontWeight: 700 }}>{x.cumple}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.amber, fontWeight: 700 }}>{x.proceso}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.rojo, fontWeight: 700 }}>{x.no}</td>
                  <td style={{ ...S.td, textAlign: 'center', fontWeight: 800, color: K.azul }}>{x.pct == null ? '—' : `${x.pct}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const S = {
  back: { background: 'none', border: 'none', color: K.azul, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 14, padding: '4px 0' },
  doc: { background: '#fff', borderRadius: 14, padding: '24px 26px', boxShadow: '0 4px 24px rgba(0,0,0,.08)', maxWidth: 880, margin: '0 auto' },
  calif: { display: 'flex', gap: 22, alignItems: 'center', border: `2px solid ${K.azul}`, borderRadius: 14, padding: '18px 22px', marginTop: 20, flexWrap: 'wrap' },
  aviso: { marginTop: 14, padding: '10px 14px', borderRadius: 8, background: K.arena, fontSize: 12.5, color: K.gris, lineHeight: 1.5 },
  secTit: { fontWeight: 800, color: K.azul, fontSize: 15, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${K.verde}` },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '9px 10px', background: K.arena, color: K.azul, fontWeight: 700, fontSize: 11 },
  td: { padding: '9px 10px', borderBottom: '1px solid #F0EDE4', color: K.carbon, verticalAlign: 'top' },
};
