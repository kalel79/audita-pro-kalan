import { KC, SEM, esc, semaforo, codigoDocumento, fechaLarga, anillo, documentoHTML } from './documentoKalan.js';
import { celdaAnexo, descuadresAnexo } from './utils.js';

const TXT_SEM = { ok: 'Favorable', warn: 'Atención', crit: 'Crítico', neutro: 'Sin evaluar' };
const GRAVEDAD = { alta: 'crit', media: 'warn', baja: 'ok' };

const badge = (texto, tono) => `<span class="badge" style="color:${SEM[tono].tx};background:${SEM[tono].bg};">${esc(texto)}</span>`;

/**
 * Dictamen técnico de auditoría sanitaria (sólo admin).
 *
 * datos: { aud, stats, d, porSeccion, noCumplidos, anexos, hallazgos, revisor, origen }
 *  - noCumplidos: filas de filasCorrectivas() (no cumple y en proceso, con acción y plazo)
 *  - hallazgos: con `foto` (DataURL) cuando esté disponible en el dispositivo
 *  - sinIdentidad: documento neutro, para el cliente que lo pide sin marca
 */
export function htmlDictamen({ aud, stats, d, porSeccion, noCumplidos, anexos, hallazgos, revisor, origen, sinIdentidad = false }) {
  const codigo = codigoDocumento('DT', aud, sinIdentidad);
  const tono = stats.total === 0 ? 'neutro' : semaforo(stats.pct);
  const color = SEM[tono].tx;
  const nNo = noCumplidos.filter((i) => i.e === 'no').length;
  const nProc = noCumplidos.filter((i) => i.e === 'proceso').length;
  let n = 0;
  const sec = (titulo) => `<h2><span class="n">${++n}.</span>${esc(titulo)}</h2>`;

  const portada = `<div class="portada">
    <div class="ante">Dictamen técnico de auditoría sanitaria</div>
    <div class="tit">${esc(aud.establecimiento)}</div>
    <div class="sub">${esc(aud.giro)}</div>
    <div class="meta"><span>Folio <b>${esc(aud.folio)}</b></span><span>Fecha de la visita <b>${esc(fechaLarga(aud.fecha))}</b></span><span>Trámite <b>${esc(aud.tramite || '—')}</b></span></div>
  </div>`;

  const datos = `${sec('Datos del establecimiento')}
  <table class="ficha">
    <tr><td class="k">Establecimiento</td><td>${esc(aud.establecimiento)}</td><td class="k">Responsable</td><td>${esc(aud.responsable || '—')}</td></tr>
    <tr><td class="k">Giro</td><td>${esc(aud.giro)}</td><td class="k">Categoría</td><td>${esc(aud.categoria || '—')}</td></tr>
    <tr><td class="k">Domicilio</td><td colspan="3">${esc(aud.domicilio || '—')}</td></tr>
    <tr><td class="k">Auditor</td><td>${esc(aud.auditor || '—')}</td><td class="k">Folio</td><td class="mono">${esc(aud.folio)}</td></tr>
    <tr><td class="k">Normativa</td><td colspan="3" style="font-size:7.5pt;">${esc(aud.normativa || '—')}</td></tr>
  </table>`;

  const metrica = (valor, etiqueta, c = KC.azulOsc) => `<div class="met"><div class="v" style="color:${c};">${valor}</div><div class="l">${etiqueta}</div></div>`;
  const resultado = `${sec('Resultado de la evaluación')}
  <div class="resultado bloque" style="border-color:${color};">
    <div class="anillo">${anillo(stats.pct, color, 108)}</div>
    <div class="cuerpo">
      <div class="etq">Dictamen</div>
      <div class="dict" style="color:${color};">${esc(d.label)}</div>
      <div class="dsub">${esc(d.sub)}</div>
      <div class="mets">
        ${metrica(`${stats.pct}%`, 'Cumplimiento ponderado', color)}
        ${metrica(stats.total, 'Reactivos evaluados')}
        ${metrica(nNo, 'No cumplen', nNo ? SEM.crit.tx : KC.azulOsc)}
        ${metrica(nProc, 'En proceso', nProc ? SEM.warn.tx : KC.azulOsc)}
        ${metrica(stats.criticosFallidos, 'Críticos incumplidos', stats.criticosFallidos ? SEM.crit.tx : KC.azulOsc)}
      </div>
    </div>
  </div>
  <div class="caja" style="margin-top:10px;border-left-color:${color};background:${SEM[tono].bg};">
    <div class="t" style="color:${color};">Conclusión</div><p>${esc(d.txt)}</p>
  </div>`;

  const areas = `${sec('Cumplimiento por área sanitaria')}
  <table class="t">
    <colgroup><col style="width:40%"><col style="width:10%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:13%"></colgroup>
    <thead><tr><th>Área sanitaria</th><th class="c">Reactivos</th><th class="c">Cumple</th><th class="c">En proceso</th><th class="c">No cumple</th><th class="c">%</th><th class="c">Semáforo</th></tr></thead>
    <tbody>${porSeccion.map((s) => {
      const ev = s.cumple + s.proceso + s.noCumple;
      const t = semaforo(s.pct, ev);
      return `<tr><td><b style="color:${KC.azulOsc};">${esc(s.seccion)}</b></td>
        <td class="c">${ev}/${s.total}</td>
        <td class="c" style="color:${SEM.ok.tx};font-weight:700;">${s.cumple}</td>
        <td class="c" style="color:${SEM.warn.tx};font-weight:700;">${s.proceso}</td>
        <td class="c" style="color:${SEM.crit.tx};font-weight:700;">${s.noCumple}</td>
        <td class="c" style="font-weight:700;color:${SEM[t].tx};">${ev ? `${s.pct}%` : '—'}</td>
        <td class="c">${badge(TXT_SEM[t], t)}</td></tr>`;
    }).join('')}</tbody>
  </table>`;

  const acciones = `${sec('No conformidades y acciones correctivas')}
  ${noCumplidos.length === 0
    ? `<div class="caja" style="border-left-color:${SEM.ok.tx};background:${SEM.ok.bg};"><div class="t" style="color:${SEM.ok.tx};">Sin no conformidades</div><p>No se identificaron reactivos en incumplimiento ni en proceso.</p></div>`
    : `<p class="intro">Se enlistan los reactivos que no cumplen o están en proceso, con la acción correctiva ${sinIdentidad ? 'recomendada' : 'que Kalan Consulting recomienda'} y el plazo sugerido para atenderla.</p>
  <table class="t acc">
    <colgroup><col style="width:5%"><col style="width:39%"><col style="width:14%"><col style="width:42%"></colgroup>
    <thead><tr><th class="c">#</th><th>Reactivo y fundamento</th><th class="c">Estado y plazo</th><th>Acción correctiva</th></tr></thead>
    <tbody>${noCumplidos.map((i, x) => `<tr>
      <td class="c"><b style="color:${KC.azulOsc};">${x + 1}</b></td>
      <td><div class="reactivo">${esc(i.t)}</div>
        <div class="det">${esc(i.seccion)} · Prioridad ${esc(i.p)}</div>
        <div class="det mono">${esc(i.f || '—')}</div>
        ${i.o ? `<div class="obs"><b>Observación:</b> ${esc(i.o)}</div>` : ''}</td>
      <td class="c">${badge(i.e === 'no' ? 'No cumple' : 'En proceso', i.e === 'no' ? 'crit' : 'warn')}
        <div class="plazo">${esc(i.plazo)}</div></td>
      <td>${i.accion ? esc(i.accion) : '<span class="suave">Sin acción registrada.</span>'}</td>
    </tr>`).join('')}</tbody>
  </table>`}`;

  const anexosHTML = anexos.map((a) => {
    const desc = descuadresAnexo(a);
    const meta = (a.meta || []).filter((m) => a[m.k]).map((m) => `<span><b>${esc(m.l)}:</b> ${esc(m.tipo === 'date' ? fechaLarga(a[m.k]) : a[m.k])}</span>`).join('');
    const total = a.cols.reduce((s, c) => s + (c.w || 90), 0);
    // Tabla y conclusión del anexo van juntas (si caben en una página).
    return `<div class="bloque">${sec(a.tit)}
    ${meta ? `<div class="anx-meta">${meta}</div>` : ''}
    <table class="t anx">
      <colgroup>${a.cols.map((c) => `<col style="width:${((c.w || 90) / total * 100).toFixed(1)}%">`).join('')}</colgroup>
      <thead><tr>${a.cols.map((c) => `<th class="${c.n ? 'c' : ''}">${esc(c.l)}</th>`).join('')}</tr></thead>
      <tbody>${a.filas.map((f) => `<tr>${a.cols.map((c) => {
        const v = celdaAnexo(c, f);
        const malo = c.calc && v !== '' && Number(v) !== 0;
        const estilo = c.calc ? `font-weight:700;color:${malo ? SEM.crit.tx : SEM.ok.tx};` : '';
        return `<td class="${c.n ? 'c' : ''}" style="${estilo}">${esc(v === '' || v == null ? '—' : v)}</td>`;
      }).join('')}</tr>`).join('')}</tbody>
    </table>
    <div class="caja" style="margin-top:8px;border-left-color:${desc.length ? SEM.crit.tx : SEM.ok.tx};background:${desc.length ? SEM.crit.bg : SEM.ok.bg};">
      <p style="color:${desc.length ? SEM.crit.tx : SEM.ok.tx};font-weight:700;">${desc.length
        ? `${desc.length} clave(s) con diferencia entre el saldo del libro de control y la existencia física.`
        : 'Sin diferencias entre el saldo del libro de control y la existencia física.'}</p>
    </div></div>`;
  }).join('');

  const evidencia = hallazgos.length === 0 ? '' : `${sec('Evidencia fotográfica de hallazgos')}
  <div class="hz-grid">${hallazgos.map((h, i) => {
    const g = GRAVEDAD[h.gravedad || h.grav] || 'warn';
    return `<div class="hz">
      ${h.foto ? `<img src="${esc(h.foto)}" alt="Evidencia del hallazgo ${i + 1}"/>`
        : `<div class="hz-sin">${h.foto_path ? 'Foto no disponible en este dispositivo' : 'Sin fotografía'}</div>`}
      <div class="hz-cab"><b>Hallazgo ${i + 1}</b>${badge(`Gravedad ${h.gravedad || h.grav}`, g)}</div>
      <p>${esc(h.descripcion || h.desc)}</p>
    </div>`;
  }).join('')}</div>`;

  const metodologia = `<div class="cierre">${sec('Metodología')}
  <p>Cada reactivo se califica como Cumple (1.0), En proceso (0.5) o No cumple (0); los reactivos que no aplican se excluyen del cálculo. El cumplimiento ponderado es la suma de las calificaciones entre el número de reactivos evaluados. Semáforo: 90 % o más, favorable; de 70 % a 89 %, atención prioritaria; menos de 70 %, riesgo sanitario alto. Un reactivo de prioridad alta en incumplimiento se considera crítico.</p>`;

  const firmas = `<div class="firmas">
    <div><div class="ln"></div><div class="cargo">Elaboró</div><div>${esc(aud.auditor || '')}</div><div class="suave">Auditor${sinIdentidad ? '' : ' · Kalan Consulting'}</div></div>
    <div><div class="ln"></div><div class="cargo">Revisó y emite</div><div>${esc(revisor || '')}</div><div class="suave">${sinIdentidad ? 'Responsable de la evaluación' : 'Kalan Consulting, S.A. de C.V.'}</div></div>
    <div><div class="ln"></div><div class="cargo">Recibe</div><div>${esc(aud.responsable || '')}</div><div class="suave">Responsable del establecimiento</div></div>
  </div>
  <div class="leyenda">Este dictamen expresa la opinión técnica ${sinIdentidad ? 'de quien lo emite' : 'de Kalan Consulting, S.A. de C.V.'} sobre las condiciones observadas el día de la visita, con base en la normativa citada. No sustituye las resoluciones de la autoridad sanitaria competente (COFEPRIS o comisión estatal) ni garantiza el sentido de una verificación oficial.</div></div>`;

  const cuerpo = [portada, datos, resultado, areas, acciones, anexosHTML, evidencia, metodologia, firmas].join('\n');

  return documentoHTML({
    tituloVentana: `${codigo} · Dictamen · ${aud.establecimiento}`,
    tipoDocumento: 'Dictamen técnico',
    codigo,
    referencia: `Folio ${aud.folio} · ${fechaLarga(aud.fecha)}`,
    origen,
    cuerpo,
    css: CSS_DICTAMEN,
    sinIdentidad,
  });
}

const CSS_DICTAMEN = `
.resultado { display: flex; gap: 18px; align-items: center; border: 1.5px solid; border-radius: 8px; padding: 14px 18px; }
.resultado .anillo { flex-shrink: 0; }
.resultado .cuerpo { flex: 1; min-width: 0; }
.resultado .etq { font-size: 7.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${KC.grisSuave}; }
.resultado .dict { font-size: 17pt; font-weight: 700; line-height: 1.15; margin-top: 2px; }
.resultado .dsub { font-size: 9pt; margin-top: 2px; }
.mets { display: flex; gap: 6px; margin-top: 10px; }
.met { flex: 1; background: ${KC.grisClaro}; border: 1px solid ${KC.borde}; border-radius: 6px; padding: 6px 4px; text-align: center; }
.met .v { font-size: 13pt; font-weight: 700; line-height: 1.1; }
.met .l { font-size: 6.5pt; color: ${KC.grisSuave}; text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; line-height: 1.2; }
.intro { margin-bottom: 8px; }
.acc .reactivo { color: #1E2B38; font-weight: 600; }
.acc .det { font-size: 7.5pt; color: ${KC.grisSuave}; margin-top: 2px; }
.acc .det.mono { color: ${KC.azulOsc}; font-size: 7.3pt; }
.acc .obs { font-size: 7.8pt; margin-top: 4px; padding: 3px 6px; background: ${KC.azulClaro}; border-radius: 3px; }
.acc .plazo { margin-top: 5px; font-size: 8pt; font-weight: 700; color: ${KC.azulOsc}; }
.anx-meta { display: flex; flex-wrap: wrap; gap: 4px 18px; font-size: 8pt; margin-bottom: 6px; }
table.anx th { font-size: 6.8pt; padding: 5px 4px; }
table.anx td { font-size: 7.8pt; padding: 5px 4px; }
.hz-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.hz { border: 1px solid ${KC.borde}; border-radius: 6px; padding: 8px; break-inside: avoid; page-break-inside: avoid; }
/* La evidencia se muestra completa, nunca recortada. */
.hz img { display: block; width: 100%; height: 2.35in; object-fit: contain; background: ${KC.grisClaro}; border-radius: 4px; }
.hz-sin { height: 0.8in; display: flex; align-items: center; justify-content: center; background: ${KC.grisClaro}; border: 1px dashed ${KC.borde}; border-radius: 4px; color: ${KC.grisSuave}; font-size: 8pt; text-align: center; padding: 8px; }
.hz-cab { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin: 7px 0 3px; color: ${KC.azulOsc}; }
.hz p { font-size: 8.5pt; }
`;
