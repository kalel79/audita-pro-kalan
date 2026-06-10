import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../lib/db';
import { K, COLOR_CAT, calcCumplimiento, dictamen } from '../lib/utils';
import Logo from './Logo';
import Donut from './Donut';

export default function Reporte() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [aud, setAud] = useState(null);
  const [hallazgos, setHallazgos] = useState([]);

  useEffect(() => {
    (async () => {
      const a = await db.auditorias.get(id);
      if (!a) { navigate('/'); return; }
      setAud(a);
      const hs = await db.hallazgos.where('auditoria_id').equals(id).toArray();
      setHallazgos(hs);
    })();
  }, [id, navigate]);

  const stats = useMemo(() => aud ? calcCumplimiento(aud.checklist || []) : { pct: 0, criticosFallidos: 0, total: 0, suma: 0 }, [aud]);
  const d = aud ? dictamen(stats.pct, stats.criticosFallidos, stats.total) : null;

  const porSeccion = useMemo(() => {
    if (!aud) return [];
    return (aud.checklist || []).map((s) => {
      let cumple = 0, noCumple = 0, proceso = 0, na = 0, evaluados = 0, sumS = 0, alta = 0;
      s.i.forEach((it) => {
        if (it.e === 'cumple') { cumple++; evaluados++; sumS += 1; }
        else if (it.e === 'no') { noCumple++; evaluados++; if (it.p === 'alta') alta++; }
        else if (it.e === 'proceso') { proceso++; evaluados++; sumS += 0.5; }
        else if (it.e === 'na') na++;
      });
      const pctS = evaluados ? Math.round((sumS / evaluados) * 100) : 0;
      const sem = evaluados === 0 ? '—' : (pctS >= 90 ? 'VERDE' : pctS >= 70 ? 'AMARILLO' : 'ROJO');
      const semColor = sem === 'VERDE' ? K.verde : sem === 'AMARILLO' ? K.amber : sem === 'ROJO' ? K.rojo : K.gris;
      return { seccion: s.s, total: s.i.length, cumple, noCumple, proceso, na, pct: pctS, sem, semColor, alta };
    });
  }, [aud]);

  const noCumplidos = useMemo(() => {
    if (!aud) return [];
    const out = [];
    (aud.checklist || []).forEach((s) => s.i.forEach((i) => { if (i.e === 'no') out.push({ ...i, seccion: s.s }); }));
    return out;
  }, [aud]);

  if (!aud || !d) return <div style={{ padding: 40, textAlign: 'center' }}><div className="apk-spin" /></div>;

  const imprimir = () => {
    const escapeHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const pill = (txt, color) => `<span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;background:${color}1A;color:${color};white-space:nowrap;">${escapeHtml(txt)}</span>`;
    const donutSvg = (p, color, size, bold) => {
      const r = size / 2 - (bold ? 7 : 5);
      const c = 2 * Math.PI * r;
      const off = c - (p / 100) * c;
      return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="#E4E0D6" stroke-width="${bold?7:5}"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${bold?7:5}" stroke-dasharray="${c}" stroke-dashoffset="${off}" stroke-linecap="round" transform="rotate(-90 ${size/2} ${size/2})"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".35em" font-size="${size*0.26}" font-weight="800" fill="${color}" font-family="Outfit,Segoe UI,sans-serif">${p}%</text>
      </svg>`;
    };
    const docField = (l, v, full) => `<div style="${full ? 'grid-column:1/-1;' : ''}"><div style="font-size:10.5px;color:${K.gris};font-weight:700;letter-spacing:.4px;">${l.toUpperCase()}</div><div style="font-size:13.5px;color:${K.carbon};margin-top:2px;font-weight:500;">${escapeHtml(v || '—')}</div></div>`;

    const tablaSecciones = `<table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px;">
      <thead><tr>
        <th style="text-align:left;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;border-bottom:2px solid ${K.azul}22;font-size:11px;">Área sanitaria</th>
        <th style="text-align:center;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">Criterios</th>
        <th style="text-align:center;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">✔</th>
        <th style="text-align:center;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">⚠</th>
        <th style="text-align:center;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">✕</th>
        <th style="text-align:center;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">%</th>
        <th style="text-align:center;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">Semáforo</th>
      </tr></thead>
      <tbody>${porSeccion.map((s) => `<tr>
        <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;"><strong>${escapeHtml(s.seccion)}</strong></td>
        <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;text-align:center;">${s.total}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;text-align:center;color:${K.verde};font-weight:700;">${s.cumple}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;text-align:center;color:${K.amber};font-weight:700;">${s.proceso}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;text-align:center;color:${K.rojo};font-weight:700;">${s.noCumple}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;text-align:center;color:${s.semColor};font-weight:800;">${s.pct}%</td>
        <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;text-align:center;">${pill(s.sem, s.semColor)}</td>
      </tr>`).join('')}</tbody></table>`;

    const tablaNoConf = noCumplidos.length === 0
      ? `<p style="font-size:13.5px;color:${K.verde};font-weight:600;">✓ No se detectaron incumplimientos en el checklist.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-size:12.5px;">
        <thead><tr>
          <th style="text-align:left;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;width:30px;">#</th>
          <th style="text-align:left;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">Criterio incumplido</th>
          <th style="text-align:left;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">Sección</th>
          <th style="text-align:center;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">Prioridad</th>
          <th style="text-align:left;padding:9px 10px;background:${K.arena};color:${K.azul};font-weight:700;font-size:11px;">Fundamento</th>
        </tr></thead><tbody>${noCumplidos.map((i, x) => {
          const pc = i.p === 'alta' ? K.rojo : i.p === 'media' ? K.amber : K.gris;
          return `<tr>
            <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;text-align:center;font-weight:700;">${x + 1}</td>
            <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;">${escapeHtml(i.t)}${i.o ? `<div style="font-size:11.5px;color:${K.gris};font-style:italic;margin-top:3px;">Obs: ${escapeHtml(i.o)}</div>` : ''}</td>
            <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;">${escapeHtml(i.seccion)}</td>
            <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;text-align:center;">${pill(i.p.toUpperCase(), pc)}</td>
            <td style="padding:9px 10px;border-bottom:1px solid #F0EDE4;font-size:11.5px;color:${K.azul};font-style:italic;">${escapeHtml(i.f || '—')}</td>
          </tr>`;
        }).join('')}</tbody></table>`;

    const hallazgosHTML = hallazgos.length === 0 ? '' : `<div style="margin-top:22px;">
      <div style="font-weight:800;color:${K.azul};font-size:15px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${K.verde};">📸 Hallazgos documentados</div>
      ${hallazgos.map((h, i) => `<div style="display:flex;gap:12px;border:1px solid #E4E0D6;border-radius:8px;padding:12px;margin-bottom:10px;page-break-inside:avoid;">
        ${(h.foto_url || h.foto) ? `<img src="${h.foto_url || h.foto}" alt="" style="width:90px;height:90px;object-fit:cover;border-radius:6px;"/>` : ''}
        <div><strong style="color:${K.carbon};">Hallazgo ${i + 1}</strong>
          <span style="font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:20px;background:#0001;color:${K.gris};margin-left:8px;">Gravedad ${h.gravedad || h.grav}</span>
          <div style="font-size:13.5px;color:${K.carbon};margin-top:4px;">${escapeHtml(h.descripcion || h.desc)}</div>
        </div></div>`).join('')}
      </div>`;

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Dictamen ${escapeHtml(aud.folio)} - ${escapeHtml(aud.establecimiento)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>*{box-sizing:border-box;}body{margin:0;padding:24px;font-family:'Outfit','Segoe UI',sans-serif;background:#F4F1EA;color:${K.carbon};}
.toolbar{max-width:880px;margin:0 auto 16px;display:flex;gap:10px;flex-wrap:wrap;}
.btn{background:linear-gradient(120deg,${K.verde},${K.verdeCl});color:#fff;border:none;padding:11px 22px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 3px 12px rgba(21,128,61,.3);}
.hint{font-size:12.5px;color:${K.gris};align-self:center;margin-left:auto;}
.doc{background:#fff;border-radius:14px;padding:34px 38px;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:880px;margin:0 auto;}
@media print{body{background:#fff;padding:0;}.toolbar{display:none;}.doc{box-shadow:none;max-width:100%;padding:20px;border-radius:0;}@page{margin:14mm;}}</style></head>
<body>
<div class="toolbar"><button class="btn" onclick="window.print()">⤓ Imprimir / Guardar como PDF</button>
<span class="hint">Selecciona <strong>"Guardar como PDF"</strong> como destino.</span></div>
<div class="doc">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;">
    <div style="display:flex;align-items:center;gap:14px;">
      <img src="${window.location.origin}/logo-kalan.png" alt="Kalan" style="width:62px;height:62px;object-fit:contain;"/>
      <div><div style="font-weight:800;font-size:20px;color:${K.azul};">KALAN CONSULTING</div>
        <div style="font-size:11.5px;color:${K.gris};">Cumplimiento Regulatorio y Gestión de Riesgo Sanitario</div>
        <div style="font-size:10.5px;color:${K.verde};font-weight:700;margin-top:2px;">#KalanProtege</div>
      </div>
    </div>
    <div style="text-align:right;">
      <div style="font-weight:800;color:${K.verde};font-size:13px;">DICTAMEN DE AUDITORÍA SANITARIA</div>
      <div style="font-size:12px;color:${K.gris};margin-top:3px;">Folio: <strong>${escapeHtml(aud.folio)}</strong></div>
      <div style="font-size:12px;color:${K.gris};">Fecha: ${escapeHtml(aud.fecha)}</div>
      <div style="font-size:10.5px;color:${K.gris};margin-top:4px;font-style:italic;">Auditoría Simulada COFEPRIS</div>
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(90deg,${K.azul},${K.verde});margin:14px 0 22px;border-radius:2px;"></div>

  <div style="font-weight:800;color:${K.azul};font-size:15px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${K.verde};">📋 Datos del establecimiento</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px 28px;margin-bottom:4px;">
    ${docField('Establecimiento', aud.establecimiento)}${docField('Giro', aud.giro)}
    ${docField('Responsable', aud.responsable)}${docField('Trámite aplicable', aud.tramite)}
    ${docField('Domicilio', aud.domicilio, true)}${docField('Normativa base', aud.normativa, true)}
    ${docField('Auditor responsable', aud.auditor)}${docField('Categoría sanitaria', aud.categoria)}
  </div>

  <div style="display:flex;gap:22px;align-items:center;border:2px solid ${d.color};border-radius:14px;padding:20px 24px;margin-top:24px;flex-wrap:wrap;page-break-inside:avoid;">
    ${donutSvg(stats.pct, d.color, 120, true)}
    <div style="flex:1;">
      <div style="font-size:12px;color:${K.gris};letter-spacing:1px;font-weight:700;">RESULTADO DE LA EVALUACIÓN</div>
      <div style="font-size:26px;font-weight:800;color:${d.color};line-height:1.1;margin:5px 0;">${d.label}</div>
      <div style="font-size:13.5px;color:${K.carbon};">${d.sub}</div>
      <div style="font-size:12.5px;color:${K.gris};margin-top:8px;">Cumplimiento ponderado: <strong style="color:${d.color};">${stats.pct}%</strong> · Reactivos evaluados: ${stats.total} · Puntaje: ${stats.suma.toFixed(1)}/${stats.total}</div>
      ${stats.criticosFallidos > 0 ? `<div style="font-size:12px;color:${K.rojo};font-weight:700;margin-top:4px;">⚠ ${stats.criticosFallidos} reactivo(s) de prioridad ALTA incumplido(s)</div>` : ''}
    </div>
  </div>

  <div style="padding:12px 16px;border-radius:8px;margin-top:14px;font-size:13px;background:${d.color}0F;border-left:4px solid ${d.color};">
    <strong style="color:${d.color};">DICTAMEN EJECUTIVO:</strong>
    <span style="margin-left:6px;color:${K.carbon};">${escapeHtml(d.txt)}</span>
  </div>

  <div style="margin-top:22px;page-break-inside:avoid;">
    <div style="font-weight:800;color:${K.azul};font-size:15px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${K.verde};">📊 Cumplimiento por área sanitaria</div>
    ${tablaSecciones}
  </div>

  <div style="margin-top:22px;">
    <div style="font-weight:800;color:${K.azul};font-size:15px;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid ${K.verde};">⚠ No conformidades detectadas</div>
    ${tablaNoConf}
  </div>

  ${hallazgosHTML}

  <div style="margin-top:28px;font-size:11px;color:${K.gris};padding:10px 14px;background:${K.arena};border-radius:8px;">
    <strong>Metodología:</strong> Cumple = 1.0 · En proceso = 0.5 · No cumple = 0 · N/A excluido. <strong>Semáforo:</strong> ≥90% APROBADO · 70-89% ATENCIÓN PRIORITARIA · &lt;70% RIESGO SANITARIO ALTO.
  </div>

  <div style="display:flex;gap:40px;margin-top:48px;justify-content:space-around;flex-wrap:wrap;page-break-inside:avoid;">
    <div style="flex:1;text-align:center;font-size:13px;max-width:280px;min-width:200px;">
      <div style="border-top:1.5px solid ${K.carbon};margin-bottom:6px;"></div>
      <strong>${escapeHtml(aud.auditor || 'Auditor / Consultor Kalan')}</strong>
      <div style="font-size:10.5px;color:${K.gris};margin-top:2px;">Auditor responsable</div>
    </div>
    <div style="flex:1;text-align:center;font-size:13px;max-width:280px;min-width:200px;">
      <div style="border-top:1.5px solid ${K.carbon};margin-bottom:6px;"></div>
      <strong>${escapeHtml(aud.responsable || 'Responsable del establecimiento')}</strong>
      <div style="font-size:10.5px;color:${K.gris};margin-top:2px;">Recibe y se entera</div>
    </div>
  </div>

  <div style="margin-top:28px;font-size:10.5px;color:${K.gris};text-align:center;border-top:1px solid #E4E0D6;padding-top:12px;">
    Documento generado por <strong>AUDITA PRO KALAN</strong> · Kalan Consulting · Apizaco, Tlaxcala · Uso interno.<br/>
    Este dictamen no sustituye resoluciones de la autoridad sanitaria competente (COFEPRIS/COEPRIST).
  </div>
</div></body></html>`;

    const w = window.open('', '_blank');
    if (!w) { alert('Permite ventanas emergentes para descargar el dictamen.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="apk-fade">
      <div className="no-print" style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <button style={S.back} onClick={() => navigate(`/auditoria/${id}`)}>← Volver a la auditoría</button>
        <button style={{ ...S.btnPrimary, marginLeft: 'auto' }} onClick={imprimir}>⤓ Descargar / Imprimir dictamen</button>
      </div>

      <div style={S.doc}>
        <div style={S.docHead}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo size={62} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 20, color: K.azul }}>KALAN CONSULTING</div>
              <div style={{ fontSize: 11.5, color: K.gris }}>Cumplimiento Regulatorio y Gestión de Riesgo Sanitario</div>
              <div style={{ fontSize: 10.5, color: K.verde, fontWeight: 700, marginTop: 2 }}>#KalanProtege</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, color: K.verde, fontSize: 13 }}>DICTAMEN DE AUDITORÍA SANITARIA</div>
            <div style={{ fontSize: 12, color: K.gris, marginTop: 3 }}>Folio: <strong>{aud.folio}</strong></div>
            <div style={{ fontSize: 12, color: K.gris }}>Fecha: {aud.fecha}</div>
          </div>
        </div>

        <div style={{ height: 3, background: `linear-gradient(90deg, ${K.azul}, ${K.verde})`, margin: '14px 0 22px', borderRadius: 2 }} />

        <SecTit>📋 Datos del establecimiento</SecTit>
        <div style={S.grid}>
          <DF l="Establecimiento" v={aud.establecimiento} />
          <DF l="Giro" v={aud.giro} />
          <DF l="Responsable" v={aud.responsable} />
          <DF l="Trámite aplicable" v={aud.tramite} />
          <DF l="Domicilio" v={aud.domicilio} full />
          <DF l="Normativa base" v={aud.normativa} full />
          <DF l="Auditor responsable" v={aud.auditor} />
          <DF l="Categoría sanitaria" v={aud.categoria} />
        </div>

        <div style={{ ...S.resultBox, borderColor: d.color }}>
          <Donut pct={stats.pct} color={d.color} size={120} bold />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: K.gris, letterSpacing: 1, fontWeight: 700 }}>RESULTADO DE LA EVALUACIÓN</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: d.color, lineHeight: 1.1, margin: '5px 0' }}>{d.label}</div>
            <div style={{ fontSize: 13.5, color: K.carbon }}>{d.sub}</div>
            <div style={{ fontSize: 12.5, color: K.gris, marginTop: 8 }}>
              Cumplimiento ponderado: <strong style={{ color: d.color }}>{stats.pct}%</strong> · Reactivos evaluados: {stats.total} · Puntaje: {stats.suma.toFixed(1)}/{stats.total}
            </div>
            {stats.criticosFallidos > 0 && (
              <div style={{ fontSize: 12, color: K.rojo, fontWeight: 700, marginTop: 4 }}>
                ⚠ {stats.criticosFallidos} reactivo(s) de prioridad ALTA incumplido(s)
              </div>
            )}
          </div>
        </div>

        <div style={{ ...S.dictBox, background: d.color + '0F', borderLeft: `4px solid ${d.color}` }}>
          <strong style={{ color: d.color, fontSize: 13 }}>DICTAMEN EJECUTIVO:</strong>
          <span style={{ marginLeft: 6, fontSize: 13.5, color: K.carbon }}>{d.txt}</span>
        </div>

        <div style={{ marginTop: 22 }}>
          <SecTit>📊 Cumplimiento por área sanitaria</SecTit>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Área</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Criterios</th>
              <th style={{ ...S.th, textAlign: 'center' }}>✔</th>
              <th style={{ ...S.th, textAlign: 'center' }}>⚠</th>
              <th style={{ ...S.th, textAlign: 'center' }}>✕</th>
              <th style={{ ...S.th, textAlign: 'center' }}>%</th>
              <th style={{ ...S.th, textAlign: 'center' }}>Semáforo</th>
            </tr></thead>
            <tbody>
              {porSeccion.map((s, x) => (
                <tr key={x}>
                  <td style={S.td}><strong>{s.seccion}</strong></td>
                  <td style={{ ...S.td, textAlign: 'center' }}>{s.total}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.verde, fontWeight: 700 }}>{s.cumple}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.amber, fontWeight: 700 }}>{s.proceso}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: K.rojo, fontWeight: 700 }}>{s.noCumple}</td>
                  <td style={{ ...S.td, textAlign: 'center', color: s.semColor, fontWeight: 800 }}>{s.pct}%</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <span style={{ ...S.pill, background: s.semColor + '1A', color: s.semColor }}>{s.sem}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 22 }}>
          <SecTit>⚠ No conformidades detectadas</SecTit>
          {noCumplidos.length === 0 ? (
            <p style={{ fontSize: 13.5, color: K.verde, fontWeight: 600 }}>✓ No se detectaron incumplimientos en el checklist.</p>
          ) : (
            <table style={S.table}>
              <thead><tr>
                <th style={{ ...S.th, width: 30 }}>#</th>
                <th style={S.th}>Criterio</th>
                <th style={S.th}>Sección</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Prioridad</th>
                <th style={S.th}>Fundamento</th>
              </tr></thead>
              <tbody>
                {noCumplidos.map((i, x) => {
                  const pc = i.p === 'alta' ? K.rojo : i.p === 'media' ? K.amber : K.gris;
                  return (
                    <tr key={x}>
                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 700 }}>{x + 1}</td>
                      <td style={S.td}>
                        {i.t}
                        {i.o && <div style={{ fontSize: 11.5, color: K.gris, fontStyle: 'italic', marginTop: 3 }}>Obs: {i.o}</div>}
                      </td>
                      <td style={S.td}>{i.seccion}</td>
                      <td style={{ ...S.td, textAlign: 'center' }}>
                        <span style={{ ...S.pill, background: pc + '1A', color: pc }}>{i.p.toUpperCase()}</span>
                      </td>
                      <td style={{ ...S.td, fontSize: 11.5, color: K.azul, fontStyle: 'italic' }}>{i.f || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {hallazgos.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <SecTit>📸 Hallazgos documentados</SecTit>
            <div style={{ display: 'grid', gap: 12 }}>
              {hallazgos.map((h, i) => (
                <div key={h.id} style={{ display: 'flex', gap: 12, border: '1px solid #E4E0D6', borderRadius: 8, padding: 12 }}>
                  {(h.foto_url || h.foto) && (
                    <img src={h.foto_url || h.foto} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 6 }} />
                  )}
                  <div>
                    <strong style={{ color: K.carbon }}>Hallazgo {i + 1}</strong>
                    <span style={{ ...S.pill, marginLeft: 8, background: '#0001', color: K.gris }}>Gravedad {h.gravedad || h.grav}</span>
                    <div style={{ fontSize: 13.5, color: K.carbon, marginTop: 4 }}>{h.descripcion || h.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: 28, fontSize: 11, color: K.gris, padding: '10px 14px', background: K.arena, borderRadius: 8 }}>
          <strong>Metodología:</strong> Cumple = 1.0 · En proceso = 0.5 · No cumple = 0 · N/A excluido. <strong>Semáforo:</strong> ≥90% APROBADO · 70-89% ATENCIÓN · &lt;70% RIESGO.
        </div>

        <div style={S.firmas}>
          <div style={S.firma}>
            <div style={S.firmaLn} />
            <strong>{aud.auditor || 'Auditor Kalan'}</strong>
            <div style={{ fontSize: 10.5, color: K.gris, marginTop: 2 }}>Auditor responsable</div>
          </div>
          <div style={S.firma}>
            <div style={S.firmaLn} />
            <strong>{aud.responsable || 'Responsable del establecimiento'}</strong>
            <div style={{ fontSize: 10.5, color: K.gris, marginTop: 2 }}>Recibe y se entera</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SecTit = ({ children }) => (
  <div style={{ fontWeight: 800, color: K.azul, fontSize: 15, marginBottom: 10, paddingBottom: 6, borderBottom: `2px solid ${K.verde}` }}>{children}</div>
);
const DF = ({ l, v, full }) => (
  <div style={{ gridColumn: full ? '1 / -1' : 'auto' }}>
    <div style={{ fontSize: 10.5, color: K.gris, fontWeight: 700, letterSpacing: 0.4 }}>{l.toUpperCase()}</div>
    <div style={{ fontSize: 13.5, color: K.carbon, marginTop: 2, fontWeight: 500 }}>{v || '—'}</div>
  </div>
);

const S = {
  back: { background: 'none', border: 'none', color: K.azul, fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  btnPrimary: { background: `linear-gradient(120deg, ${K.verde}, ${K.verdeCl})`, color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14.5, cursor: 'pointer' },
  doc: { background: '#fff', borderRadius: 14, padding: '28px 32px', boxShadow: '0 4px 24px rgba(0,0,0,.08)', maxWidth: 880, margin: '0 auto' },
  docHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px', marginBottom: 4 },
  resultBox: { display: 'flex', gap: 22, alignItems: 'center', border: '2px solid', borderRadius: 14, padding: '20px 24px', marginTop: 24, flexWrap: 'wrap' },
  dictBox: { padding: '12px 16px', borderRadius: 8, marginTop: 14, fontSize: 13 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 },
  th: { textAlign: 'left', padding: '9px 10px', background: K.arena, color: K.azul, fontWeight: 700, borderBottom: `2px solid ${K.azul}22`, fontSize: 11 },
  td: { padding: '9px 10px', borderBottom: '1px solid #F0EDE4', color: K.carbon, verticalAlign: 'top' },
  pill: { fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' },
  firmas: { display: 'flex', gap: 40, marginTop: 44, justifyContent: 'space-around', flexWrap: 'wrap' },
  firma: { flex: 1, textAlign: 'center', fontSize: 13, color: K.carbon, maxWidth: 280, minWidth: 200 },
  firmaLn: { borderTop: `1.5px solid ${K.carbon}`, marginBottom: 6 },
};
