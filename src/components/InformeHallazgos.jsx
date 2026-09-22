import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { asegurarFotoLocal } from '../lib/fotos';
import { KC, SEM, codigoDocumento, fechaLarga } from '../lib/documentoKalan';
import { htmlInforme, ordenarHallazgos, conclusionInforme, gravedadDe } from '../lib/documentoInforme';
import FotoHallazgo from './FotoHallazgo';

/** Informe de hallazgos con evidencia fotográfica (sólo admin). */
export default function InformeHallazgos({ usuario, perfil }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aud, setAud] = useState(null);
  const [hallazgos, setHallazgos] = useState([]);
  const [fotosListas, setFotosListas] = useState(false);
  // Documento neutro para el cliente que lo pide sin marca. Arranca apagado:
  // lo normal es entregar con la identidad de Kalan.
  const [sinIdentidad, setSinIdentidad] = useState(false);

  useEffect(() => {
    (async () => {
      const a = await db.auditorias.get(id);
      if (!a) { navigate('/'); return; }
      setAud(a);
      const hs = await db.hallazgos.where('auditoria_id').equals(id).toArray();
      setHallazgos(hs);
      // El documento lleva las fotos incrustadas: se traen las que falten.
      const conFoto = await Promise.all(hs.map(async (h) => (
        h.foto || !h.foto_path ? h : { ...h, foto: await asegurarFotoLocal(h).catch(() => null) }
      )));
      setHallazgos(conFoto);
      setFotosListas(true);
    })();
  }, [id, navigate]);

  const ordenados = useMemo(() => ordenarHallazgos(hallazgos), [hallazgos]);

  if (!aud) return <div style={{ padding: 40, textAlign: 'center' }}><div className="apk-spin" /></div>;

  const codigo = codigoDocumento('IN', aud);
  const revisor = (perfil?.nombre || usuario?.email || '').trim();
  const sinFoto = ordenados.filter((h) => h.foto_path && !h.foto).length;
  const { texto: conclusion, critico } = conclusionInforme(hallazgos);

  const exportar = () => {
    if (sinFoto > 0 && !confirm(`${sinFoto} foto(s) no están en este dispositivo (se necesita internet para descargarlas). ¿Generar el informe sin ellas?`)) return;
    const w = window.open('', '_blank');
    if (!w) { alert('Permite ventanas emergentes para generar el informe.'); return; }
    w.document.open();
    w.document.write(htmlInforme({ aud, hallazgos, revisor, origen: window.location.origin, sinIdentidad }));
    w.document.close();
  };

  return (
    <div className="apk-fade">
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={S.back} onClick={() => navigate(`/reporte/${id}`)}>← Volver al dictamen</button>
        <label style={{ ...S.sinId, marginLeft: 'auto' }} title="Genera el informe sin logotipo, sin razón social, sin datos de contacto y en grises.">
          <input type="checkbox" checked={sinIdentidad} onChange={(e) => setSinIdentidad(e.target.checked)} />
          Sin identidad Kalan
        </label>
        <button style={S.btn} onClick={exportar} disabled={!fotosListas}>
          {fotosListas ? '⤓ Descargar / Imprimir informe' : 'Preparando fotos…'}
        </button>
      </div>

      <div style={S.doc}>
        <div style={S.enc}>
          <img src="/logo-kalan.png" alt="Kalan Consulting" style={{ width: 52, height: 52, objectFit: 'contain' }} />
          <div style={{ textAlign: 'right', fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 700, color: KC.azulOsc }}>Kalan Consulting, S.A. de C.V.</div>
            <div>Informe de hallazgos</div>
            <div style={S.mono}>{codigo}</div>
          </div>
        </div>

        <div style={S.num}>Informe técnico</div>
        <h1 style={S.h1}>Informe de hallazgos con evidencia fotográfica</h1>
        <div style={S.rule} />

        <div style={{ ...S.callout, ...(critico ? S.calloutCrit : {}) }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: critico ? SEM.crit.tx : KC.azulOsc }}>Conclusión</div>
          <div style={S.p}>{conclusion}</div>
        </div>

        <div style={S.h2}>Datos de la visita</div>
        <div style={S.datos}>
          {[
            ['Establecimiento', aud.establecimiento], ['Giro', aud.giro], ['Domicilio', aud.domicilio],
            ['Responsable', aud.responsable], ['Fecha de la visita', fechaLarga(aud.fecha)],
            ['Auditor', aud.auditor], ['Folio', aud.folio],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <div style={S.dk}>{k}</div><div style={S.dv}>{v || '—'}</div>
            </div>
          ))}
        </div>

        <div style={S.h2}>Hallazgos documentados</div>
        {ordenados.length === 0 && <div style={S.p}>No se registraron hallazgos en esta auditoría.</div>}
        <div style={{ display: 'grid', gap: 14 }}>
          {ordenados.map((h, i) => {
            const g = gravedadDe(h);
            return (
              <div key={h.id} style={S.hz}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <strong style={{ color: KC.azulOsc, fontSize: 15 }}>Hallazgo {i + 1}</strong>
                  <span style={{ ...S.badge, color: SEM[g.tono].tx, background: SEM[g.tono].bg }}>{g.l}</span>
                  {h.creado_en && <span style={{ fontSize: 12, color: KC.grisSuave, marginLeft: 'auto' }}>{fechaLarga(h.creado_en)}</span>}
                </div>
                <div style={S.p}>{h.descripcion || h.desc}</div>
                {(h.foto || h.foto_path) && (
                  <div style={{ marginTop: 10 }}><FotoHallazgo h={h} size={260} radius={6} /></div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Lista de auditorías con acceso a su informe de hallazgos (sólo admin). */
export function InformesLista() {
  const navigate = useNavigate();
  const auditorias = useLiveQuery(() => db.auditorias.orderBy('fecha').reverse().toArray()) || [];
  const conteos = useLiveQuery(async () => {
    const m = {};
    (await db.hallazgos.toArray()).forEach((h) => { m[h.auditoria_id] = (m[h.auditoria_id] || 0) + 1; });
    return m;
  }) || {};

  return (
    <div className="apk-fade">
      <h2 style={{ color: KC.azulOsc, margin: '0 0 4px' }}>Informes de hallazgos</h2>
      <p style={{ color: KC.gris, fontSize: 13, margin: '0 0 18px' }}>
        Informe profesional con la evidencia fotográfica y la descripción de cada hallazgo. Sólo lo ven los administradores.
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {auditorias.map((a) => (
          <button key={a.id} style={S.fila} onClick={() => navigate(`/informe/${a.id}`)}>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: KC.azulOsc }}>{a.establecimiento || 'Sin nombre'}</div>
              <div style={{ fontSize: 12, color: KC.gris, marginTop: 2 }}>{a.giro} · {a.fecha} · {(a.auditor || '').trim()}</div>
            </div>
            <span style={{ ...S.badge, color: KC.azulOsc, background: KC.azulClaro }}>
              {conteos[a.id] || 0} {(conteos[a.id] || 0) === 1 ? 'hallazgo' : 'hallazgos'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

const S = {
  back: { background: 'none', border: 'none', color: KC.azulOsc, fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: '4px 0' },
  btn: { background: KC.azul, color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  sinId: { display: 'flex', alignItems: 'center', gap: 7, color: KC.gris, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', userSelect: 'none' },
  doc: { background: '#fff', borderRadius: 12, padding: '26px 28px', boxShadow: '0 4px 24px rgba(23,85,143,.1)', maxWidth: 880, margin: '0 auto', fontFamily: 'Inter, "Segoe UI", Calibri, Arial, sans-serif', color: KC.gris },
  enc: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingBottom: 10, borderBottom: `1.5px solid ${KC.verde}` },
  mono: { fontFamily: 'Consolas, monospace', fontSize: 11.5, color: KC.azulOsc },
  num: { fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: KC.verdeOsc, textTransform: 'uppercase', marginTop: 22 },
  h1: { fontSize: 26, fontWeight: 700, color: KC.azulOsc, margin: '6px 0 4px', lineHeight: 1.15 },
  rule: { height: 4, width: 68, background: KC.verde, margin: '12px 0 18px' },
  h2: { fontSize: 16, fontWeight: 700, color: KC.verdeOsc, margin: '24px 0 10px' },
  p: { fontSize: 13.5, lineHeight: 1.62, textAlign: 'justify' },
  callout: { borderLeft: `5px solid ${KC.azulOsc}`, background: KC.azulClaro, borderRadius: '0 7px 7px 0', padding: '12px 16px' },
  calloutCrit: { borderLeftColor: SEM.crit.tx, background: SEM.crit.bg },
  datos: { display: 'grid', gridTemplateColumns: 'minmax(120px, 30%) 1fr', border: `1px solid ${KC.borde}`, borderRadius: 8, overflow: 'hidden' },
  dk: { padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: KC.azulOsc, background: KC.grisClaro, borderBottom: `1px solid ${KC.borde}` },
  dv: { padding: '8px 12px', fontSize: 13, borderBottom: `1px solid ${KC.borde}` },
  hz: { border: `1px solid ${KC.borde}`, borderRadius: 8, padding: '14px 16px' },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' },
  fila: { display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: `1px solid ${KC.borde}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', font: 'inherit' },
};
