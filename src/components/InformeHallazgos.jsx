import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { asegurarFotoLocal } from '../lib/fotos';
import FotoHallazgo from './FotoHallazgo';

// Identidad Kalan Consulting (manual de marca). Los documentos para cliente
// usan esta paleta; la interfaz de la app conserva la suya.
const KC = {
  azul: '#2682D9', verde: '#3CD482', azulOsc: '#17558F', verdeOsc: '#1F9E5F',
  gris: '#4A4A4A', azulClaro: '#E4F0FC', grisClaro: '#F5F9FD', borde: '#E3ECF5',
};
const GRAVEDAD = {
  alta: { l: 'Gravedad alta', tx: '#B3261E', bg: '#FDEBEB' },
  media: { l: 'Gravedad media', tx: '#B36A00', bg: '#FFF6E6' },
  baja: { l: 'Gravedad baja', tx: '#1F7A45', bg: '#E8F7EE' },
};
const CONTACTO = 'Kalan Consulting, S.A. de C.V. | Tlaxcala, Tlaxcala, México | Tel. 246 126 4733 · 55 3597 1981 | kalanconsultoria.com';
const ORDEN_GRAVEDAD = { alta: 0, media: 1, baja: 2 };

const gravedadDe = (h) => GRAVEDAD[h.gravedad || h.grav] || GRAVEDAD.media;

/** KC-IN-AAAA-MMDD-CLIENTE */
function codigoInforme(aud) {
  const [a = '0000', m = '00', d = '00'] = String(aud.fecha || '').split('-');
  const cliente = (aud.establecimiento || 'CLIENTE')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/)
    .filter((w) => w.length > 2).slice(0, 3).join('').toUpperCase().slice(0, 16) || 'CLIENTE';
  return `KC-IN-${a}-${m}${d}-${cliente}`;
}

function fechaLarga(iso) {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

const escapeHtml = (s) => String(s == null ? '' : s)
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function InformeHallazgos({ usuario, perfil }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aud, setAud] = useState(null);
  const [hallazgos, setHallazgos] = useState([]);
  const [fotosListas, setFotosListas] = useState(false);

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

  const ordenados = useMemo(() => [...hallazgos].sort((a, b) => (
    (ORDEN_GRAVEDAD[a.gravedad || a.grav] ?? 1) - (ORDEN_GRAVEDAD[b.gravedad || b.grav] ?? 1)
    || String(a.creado_en || '').localeCompare(String(b.creado_en || ''))
  )), [hallazgos]);

  const conteo = useMemo(() => {
    const c = { alta: 0, media: 0, baja: 0 };
    hallazgos.forEach((h) => { c[h.gravedad || h.grav] = (c[h.gravedad || h.grav] || 0) + 1; });
    return c;
  }, [hallazgos]);

  if (!aud) return <div style={{ padding: 40, textAlign: 'center' }}><div className="apk-spin" /></div>;

  const codigo = codigoInforme(aud);
  const revisor = (perfil?.nombre || usuario?.email || '').trim();
  const sinFoto = ordenados.filter((h) => h.foto_path && !h.foto).length;

  const conclusion = hallazgos.length === 0
    ? 'Durante la visita no se documentaron hallazgos con evidencia fotográfica.'
    : `Durante la visita se documentaron ${hallazgos.length} ${hallazgos.length === 1 ? 'hallazgo' : 'hallazgos'} con evidencia: `
      + `${conteo.alta} de gravedad alta, ${conteo.media} de gravedad media y ${conteo.baja} de gravedad baja. `
      + (conteo.alta > 0
        ? 'Los hallazgos de gravedad alta requieren atención inmediata, ya que pueden motivar medidas de seguridad en una verificación sanitaria.'
        : 'No se identificaron hallazgos de gravedad alta.');

  const exportar = () => {
    if (sinFoto > 0 && !confirm(`${sinFoto} foto(s) no están en este dispositivo (se necesita internet para descargarlas). ¿Generar el informe sin ellas?`)) return;
    const logo = `${window.location.origin}/logo-kalan.png`;
    const tarjetas = ordenados.map((h, i) => {
      const g = gravedadDe(h);
      return `<div class="hz">
        <div class="hz-head"><span class="hz-num">Hallazgo ${i + 1}</span>
          <span class="badge" style="color:${g.tx};background:${g.bg};">${g.l}</span>
          ${h.creado_en ? `<span class="hz-fecha">${escapeHtml(fechaLarga(h.creado_en))}</span>` : ''}</div>
        <p>${escapeHtml(h.descripcion || h.desc)}</p>
        ${h.foto ? `<img class="hz-foto" src="${escapeHtml(h.foto)}" alt="Evidencia del hallazgo ${i + 1}"/>`
          : h.foto_path ? '<div class="hz-sinfoto">Evidencia fotográfica no disponible en este dispositivo.</div>' : ''}
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${escapeHtml(codigo)} · Informe de hallazgos · ${escapeHtml(aud.establecimiento)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
@page { size: Letter; margin: 0.9in 0.75in 0.85in; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Inter","Segoe UI","Calibri",Arial,sans-serif; color: ${KC.gris}; background: ${KC.grisClaro};
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.toolbar { max-width: 8.5in; margin: 20px auto 14px; display: flex; gap: 12px; align-items: center; padding: 0 12px; }
.btn { background: ${KC.azul}; color: #fff; border: none; padding: 11px 22px; border-radius: 8px; font: 700 14px Inter,sans-serif; cursor: pointer; }
.hint { font-size: 12.5px; color: ${KC.gris}; }
.doc { background: #fff; max-width: 8.5in; margin: 0 auto 40px; padding: 0.9in 0.75in 0.85in; box-shadow: 0 4px 24px rgba(23,85,143,.1); }
.enc { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding-bottom: 10px; border-bottom: 1.5px solid ${KC.verde}; }
.enc img { width: 57px; height: 57px; object-fit: contain; }
.enc .der { text-align: right; font-size: 9pt; line-height: 1.5; }
.enc .rs { font-weight: 700; color: ${KC.azulOsc}; }
.num { font-size: 9pt; font-weight: 700; letter-spacing: .18em; color: ${KC.verdeOsc}; text-transform: uppercase; margin-top: 26px; }
h1 { font-size: 25pt; font-weight: 700; color: ${KC.azulOsc}; margin: 6px 0 4px; letter-spacing: -.4px; line-height: 1.15; }
.rule { height: 4px; width: 68px; background: ${KC.verde}; margin: 12px 0 20px; }
h2 { font-size: 12.5pt; font-weight: 700; color: ${KC.verdeOsc}; margin: 24px 0 10px; }
p { font-size: 10pt; line-height: 1.62; text-align: justify; }
table { width: 100%; border-collapse: collapse; }
td { font-size: 9pt; padding: 7px 10px; border-bottom: 1px solid ${KC.borde}; vertical-align: top; line-height: 1.5; }
td.k { width: 30%; font-weight: 700; color: ${KC.azulOsc}; background: ${KC.grisClaro}; }
.mono { font-family: Consolas, monospace; font-size: 8.5pt; color: ${KC.azulOsc}; }
.callout { border-left: 5px solid ${KC.azulOsc}; background: ${KC.azulClaro}; border-radius: 0 7px 7px 0; padding: 14px 16px; margin: 6px 0 4px; }
.callout .t { font-size: 9.5pt; font-weight: 700; color: ${KC.azulOsc}; margin-bottom: 6px; }
.callout.crit { border-left-color: #B3261E; background: #FDEBEB; } .callout.crit .t { color: #B3261E; }
.hz { border: 1px solid ${KC.borde}; border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; page-break-inside: avoid; }
.hz-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.hz-num { font-weight: 700; color: ${KC.azulOsc}; font-size: 11pt; }
.badge { font-size: 8pt; font-weight: 700; padding: 3px 9px; border-radius: 20px; }
.hz-fecha { font-size: 8.5pt; color: #8FA6BC; margin-left: auto; }
.hz-foto { display: block; max-width: 100%; max-height: 3.6in; margin-top: 10px; border-radius: 6px; border: 1px solid ${KC.borde}; }
.hz-sinfoto { margin-top: 10px; font-size: 9pt; color: #8FA6BC; border: 1px dashed ${KC.borde}; border-radius: 6px; padding: 14px; text-align: center; }
.firmas { display: flex; gap: 48px; margin-top: 56px; page-break-inside: avoid; }
.firma { flex: 1; text-align: center; font-size: 9.5pt; }
.firma .ln { border-top: 1.5px solid ${KC.azulOsc}; margin-bottom: 6px; }
.firma .cargo { font-weight: 700; color: ${KC.azulOsc}; }
.pie { margin-top: 36px; border-top: 1.5px solid ${KC.azul}; padding-top: 8px; font-size: 7.5pt; color: #8FA6BC; line-height: 1.6; }
.pie .cod { display: flex; justify-content: space-between; }
.nota { font-size: 8.5pt; color: #8FA6BC; margin-top: 14px; text-align: justify; line-height: 1.5; }
@media print { body { background: #fff; } .toolbar { display: none; } .doc { box-shadow: none; margin: 0; padding: 0; max-width: none; } }
</style></head><body>
<div class="toolbar"><button class="btn" onclick="window.print()">⤓ Imprimir / Guardar como PDF</button>
<span class="hint">Elige «Guardar como PDF» como destino y activa «Gráficos de fondo».</span></div>
<div class="doc">
  <div class="enc"><img src="${logo}" alt="Kalan Consulting"/>
    <div class="der"><div class="rs">Kalan Consulting, S.A. de C.V.</div><div>Informe de hallazgos</div><div class="mono">${escapeHtml(codigo)}</div></div></div>

  <div class="num">Informe técnico</div>
  <h1>Informe de hallazgos con evidencia fotográfica</h1>
  <div class="rule"></div>

  <div class="callout${conteo.alta > 0 ? ' crit' : ''}"><div class="t">Conclusión</div><p>${escapeHtml(conclusion)}</p></div>

  <h2>Datos de la visita</h2>
  <table>
    <tr><td class="k">Establecimiento</td><td>${escapeHtml(aud.establecimiento)}</td></tr>
    <tr><td class="k">Giro</td><td>${escapeHtml(aud.giro)}</td></tr>
    <tr><td class="k">Domicilio</td><td>${escapeHtml(aud.domicilio || '—')}</td></tr>
    <tr><td class="k">Responsable del establecimiento</td><td>${escapeHtml(aud.responsable || '—')}</td></tr>
    <tr><td class="k">Fecha de la visita</td><td>${escapeHtml(fechaLarga(aud.fecha))}</td></tr>
    <tr><td class="k">Auditor</td><td>${escapeHtml(aud.auditor || '—')}</td></tr>
    <tr><td class="k">Folio de auditoría</td><td class="mono">${escapeHtml(aud.folio)}</td></tr>
    <tr><td class="k">Normativa de referencia</td><td>${escapeHtml(aud.normativa || '—')}</td></tr>
  </table>

  <h2>Hallazgos documentados</h2>
  ${tarjetas || '<p>No se registraron hallazgos en esta auditoría.</p>'}

  <div class="firmas">
    <div class="firma"><div class="ln"></div><div class="cargo">Auditor</div><div>${escapeHtml(aud.auditor || '')}</div><div>Kalan Consulting, S.A. de C.V.</div></div>
    <div class="firma"><div class="ln"></div><div class="cargo">Revisó</div><div>${escapeHtml(revisor)}</div><div>Kalan Consulting, S.A. de C.V.</div></div>
  </div>

  <div class="nota">Este informe describe las condiciones observadas el día de la visita y no sustituye las resoluciones de la autoridad sanitaria competente (COFEPRIS o comisión estatal).</div>

  <div class="pie"><div>${escapeHtml(CONTACTO)}</div><div class="cod"><span class="mono">${escapeHtml(codigo)}</span><span>#KalanProtege</span></div></div>
</div></body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permite ventanas emergentes para generar el informe.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="apk-fade">
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={S.back} onClick={() => navigate(`/reporte/${id}`)}>← Volver al dictamen</button>
        <button style={{ ...S.btn, marginLeft: 'auto' }} onClick={exportar} disabled={!fotosListas}>
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

        <div style={{ ...S.callout, ...(conteo.alta > 0 ? S.calloutCrit : {}) }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: conteo.alta > 0 ? '#B3261E' : KC.azulOsc }}>Conclusión</div>
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
                  <span style={{ ...S.badge, color: g.tx, background: g.bg }}>{g.l}</span>
                  {h.creado_en && <span style={{ fontSize: 12, color: '#8FA6BC', marginLeft: 'auto' }}>{fechaLarga(h.creado_en)}</span>}
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
  doc: { background: '#fff', borderRadius: 12, padding: '26px 28px', boxShadow: '0 4px 24px rgba(23,85,143,.1)', maxWidth: 880, margin: '0 auto', fontFamily: 'Inter, "Segoe UI", Calibri, Arial, sans-serif', color: KC.gris },
  enc: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, paddingBottom: 10, borderBottom: `1.5px solid ${KC.verde}` },
  mono: { fontFamily: 'Consolas, monospace', fontSize: 11.5, color: KC.azulOsc },
  num: { fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: KC.verdeOsc, textTransform: 'uppercase', marginTop: 22 },
  h1: { fontSize: 26, fontWeight: 700, color: KC.azulOsc, margin: '6px 0 4px', lineHeight: 1.15 },
  rule: { height: 4, width: 68, background: KC.verde, margin: '12px 0 18px' },
  h2: { fontSize: 16, fontWeight: 700, color: KC.verdeOsc, margin: '24px 0 10px' },
  p: { fontSize: 13.5, lineHeight: 1.62, textAlign: 'justify' },
  callout: { borderLeft: `5px solid ${KC.azulOsc}`, background: KC.azulClaro, borderRadius: '0 7px 7px 0', padding: '12px 16px' },
  calloutCrit: { borderLeftColor: '#B3261E', background: '#FDEBEB' },
  datos: { display: 'grid', gridTemplateColumns: 'minmax(120px, 30%) 1fr', border: `1px solid ${KC.borde}`, borderRadius: 8, overflow: 'hidden' },
  dk: { padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: KC.azulOsc, background: KC.grisClaro, borderBottom: `1px solid ${KC.borde}` },
  dv: { padding: '8px 12px', fontSize: 13, borderBottom: `1px solid ${KC.borde}` },
  hz: { border: `1px solid ${KC.borde}`, borderRadius: 8, padding: '14px 16px' },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' },
  fila: { display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: `1px solid ${KC.borde}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', font: 'inherit' },
};
