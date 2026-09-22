import { KC, SEM, esc, codigoDocumento, fechaLarga, documentoHTML } from './documentoKalan.js';

const GRAVEDAD = {
  alta: { l: 'Gravedad alta', tono: 'crit' },
  media: { l: 'Gravedad media', tono: 'warn' },
  baja: { l: 'Gravedad baja', tono: 'ok' },
};
const ORDEN = { alta: 0, media: 1, baja: 2 };
export const gravedadDe = (h) => GRAVEDAD[h.gravedad || h.grav] || GRAVEDAD.media;

/** Hallazgos del más grave al menos grave y, dentro de cada gravedad, por fecha. */
export function ordenarHallazgos(hallazgos) {
  return [...hallazgos].sort((a, b) => (
    (ORDEN[a.gravedad || a.grav] ?? 1) - (ORDEN[b.gravedad || b.grav] ?? 1)
    || String(a.creado_en || '').localeCompare(String(b.creado_en || ''))
  ));
}

/** Primero la conclusión (manual de marca). */
export function conclusionInforme(hallazgos) {
  const c = { alta: 0, media: 0, baja: 0 };
  hallazgos.forEach((h) => { c[h.gravedad || h.grav] = (c[h.gravedad || h.grav] || 0) + 1; });
  if (hallazgos.length === 0) return { texto: 'Durante la visita no se documentaron hallazgos con evidencia fotográfica.', critico: false };
  const texto = `Durante la visita se documentaron ${hallazgos.length} ${hallazgos.length === 1 ? 'hallazgo' : 'hallazgos'} con evidencia: `
    + `${c.alta} de gravedad alta, ${c.media} de gravedad media y ${c.baja} de gravedad baja. `
    + (c.alta > 0
      ? 'Los hallazgos de gravedad alta requieren atención inmediata, ya que pueden motivar medidas de seguridad en una verificación sanitaria.'
      : 'No se identificaron hallazgos de gravedad alta.');
  return { texto, critico: c.alta > 0 };
}

/** Informe de hallazgos con evidencia fotográfica (sólo admin). */
export function htmlInforme({ aud, hallazgos, revisor, origen, sinIdentidad = false }) {
  const codigo = codigoDocumento('IN', aud, sinIdentidad);
  const lista = ordenarHallazgos(hallazgos);
  const { texto, critico } = conclusionInforme(hallazgos);
  const t = critico ? SEM.crit : { tx: KC.azulOsc, bg: KC.azulClaro };

  const cuerpo = `
  <div class="portada">
    <div class="ante">Informe de hallazgos con evidencia fotográfica</div>
    <div class="tit">${esc(aud.establecimiento)}</div>
    <div class="sub">${esc(aud.giro)}</div>
    <div class="meta"><span>Folio <b>${esc(aud.folio)}</b></span><span>Fecha de la visita <b>${esc(fechaLarga(aud.fecha))}</b></span><span>Hallazgos <b>${hallazgos.length}</b></span></div>
  </div>

  <div class="caja" style="margin-top:14px;border-left-color:${t.tx};background:${t.bg};">
    <div class="t" style="color:${t.tx};">Conclusión</div><p>${esc(texto)}</p>
  </div>

  <h2><span class="n">1.</span>Datos de la visita</h2>
  <table class="ficha">
    <tr><td class="k">Establecimiento</td><td>${esc(aud.establecimiento)}</td><td class="k">Responsable</td><td>${esc(aud.responsable || '—')}</td></tr>
    <tr><td class="k">Domicilio</td><td colspan="3">${esc(aud.domicilio || '—')}</td></tr>
    <tr><td class="k">Auditor</td><td>${esc(aud.auditor || '—')}</td><td class="k">Folio</td><td class="mono">${esc(aud.folio)}</td></tr>
    <tr><td class="k">Normativa</td><td colspan="3" style="font-size:7.5pt;">${esc(aud.normativa || '—')}</td></tr>
  </table>

  <h2><span class="n">2.</span>Hallazgos documentados</h2>
  ${lista.length === 0 ? '<p>No se registraron hallazgos en esta auditoría.</p>' : lista.map((h, i) => {
    const g = gravedadDe(h);
    // Ficha de evidencia: foto a la izquierda, datos a la derecha.
    const foto = h.foto
      ? `<div class="hz-marco"><img src="${esc(h.foto)}" alt="Evidencia del hallazgo ${i + 1}"/></div>`
      : `<div class="hz-marco hz-sin">${h.foto_path ? 'Evidencia fotográfica no disponible en este dispositivo.' : 'Sin fotografía'}</div>`;
    return `<div class="hz">${foto}
      <div class="hz-datos">
        <div class="hz-num">Hallazgo ${i + 1}</div>
        <span class="badge" style="color:${SEM[g.tono].tx};background:${SEM[g.tono].bg};">${g.l}</span>
        ${h.creado_en ? `<div class="hz-fecha">Registrado el ${esc(fechaLarga(h.creado_en))}</div>` : ''}
        <div class="hz-et">Descripción</div>
        <p>${esc(h.descripcion || h.desc)}</p>
      </div>
    </div>`;
  }).join('')}

  <div class="cierre">
    <div class="firmas">
      <div><div class="ln"></div><div class="cargo">Elaboró</div><div>${esc(aud.auditor || '')}</div><div class="suave">Auditor${sinIdentidad ? '' : ' · Kalan Consulting'}</div></div>
      <div><div class="ln"></div><div class="cargo">Revisó</div><div>${esc(revisor || '')}</div><div class="suave">${sinIdentidad ? 'Responsable de la evaluación' : 'Kalan Consulting, S.A. de C.V.'}</div></div>
    </div>
    <div class="leyenda">Este informe describe las condiciones observadas el día de la visita y no sustituye las resoluciones de la autoridad sanitaria competente (COFEPRIS o comisión estatal).</div>
  </div>`;

  return documentoHTML({
    tituloVentana: `${codigo} · Informe de hallazgos · ${aud.establecimiento}`,
    tipoDocumento: 'Informe de hallazgos',
    codigo,
    referencia: `Folio ${aud.folio} · ${fechaLarga(aud.fecha)}`,
    origen,
    cuerpo,
    sinIdentidad,
    css: `
.hz { display: grid; grid-template-columns: 58% 1fr; gap: 14px; border: 1px solid ${KC.borde}; border-radius: 6px; padding: 10px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
/* La evidencia se muestra completa, nunca recortada. */
.hz-marco { height: 2.55in; background: ${KC.grisClaro}; border: 1px solid ${KC.borde}; border-radius: 4px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.hz-marco img { max-width: 100%; max-height: 100%; object-fit: contain; }
.hz-sin { border-style: dashed; color: ${KC.grisSuave}; font-size: 8pt; text-align: center; padding: 12px; }
.hz-datos { padding: 4px 4px 4px 0; }
.hz-num { font-weight: 700; color: ${KC.azulOsc}; font-size: 12pt; margin-bottom: 5px; }
.hz-fecha { font-size: 7.5pt; color: ${KC.grisSuave}; margin-top: 6px; }
.hz-et { font-size: 7pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: ${KC.verdeOsc}; margin: 12px 0 3px; }
.hz-datos p { text-align: left; }
`,
  });
}
