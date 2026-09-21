/**
 * Base de los documentos imprimibles de Kalan Consulting (dictamen, informe).
 *
 * Hoja carta. El encabezado y el pie se repiten en cada página: van con
 * position: fixed (Chrome los imprime en todas) y una tabla marco reserva su
 * espacio con thead/tfoot, que también se repiten. La paginación usa las cajas
 * de margen de @page; en navegadores que no las soportan simplemente no sale.
 *
 * Sin dependencias del navegador para poder generarlo y probarlo con Node.
 */

// Manual de marca Kalan Consulting.
export const KC = {
  azul: '#2682D9', verde: '#3CD482', azulOsc: '#17558F', verdeOsc: '#1F9E5F',
  gris: '#4A4A4A', grisSuave: '#8FA6BC', azulClaro: '#E4F0FC', grisClaro: '#F5F9FD', borde: '#E3ECF5',
};

export const SEM = {
  ok: { tx: '#1F7A45', bg: '#E8F7EE' },
  warn: { tx: '#B36A00', bg: '#FFF6E6' },
  crit: { tx: '#B3261E', bg: '#FDEBEB' },
  neutro: { tx: '#5B6B7B', bg: '#EEF2F6' },
};

export const CONTACTO = 'Kalan Consulting, S.A. de C.V. · Tlaxcala, Tlaxcala, México · Tel. 246 126 4733 · 55 3597 1981 · kalanconsultoria.com';

export const esc = (s) => String(s == null ? '' : s)
  .replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Semáforo de Kalan: ≥90 favorable, 70–89 atención, <70 crítico. */
export function semaforo(pct, evaluados = 1) {
  if (!evaluados) return 'neutro';
  return pct >= 90 ? 'ok' : pct >= 70 ? 'warn' : 'crit';
}

/** KC-XX-AAAA-MMDD-CLIENTE (manual de marca). */
export function codigoDocumento(tipo, aud) {
  const [a = '0000', m = '00', d = '00'] = String(aud.fecha || '').split('-');
  const cliente = String(aud.establecimiento || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/)
    .filter((w) => w.length > 2).slice(0, 3).join('').toUpperCase().slice(0, 16) || 'CLIENTE';
  return `KC-${tipo}-${a}-${m}${d}-${cliente}`;
}

export function fechaLarga(iso) {
  if (!iso) return '—';
  const d = new Date(String(iso).length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Anillo de cumplimiento en SVG. */
export function anillo(pct, color, size = 112) {
  const g = 9, r = size / 2 - g, c = 2 * Math.PI * r, off = c - (Math.max(0, Math.min(100, pct)) / 100) * c;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${KC.borde}" stroke-width="${g}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${g}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${Math.round(size * 0.24)}" font-weight="700" fill="${color}" font-family="Inter,Segoe UI,Arial,sans-serif">${pct}%</text>
  </svg>`;
}

const CSS = `
@page { size: Letter; margin: 0.42in 0.6in 0.5in;
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 600 7.5pt Inter, "Segoe UI", Arial, sans-serif; color: ${KC.grisSuave}; } }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #E9EEF4; }
body { font-family: Inter, "Segoe UI", Calibri, Arial, sans-serif; color: ${KC.gris}; font-size: 9.5pt; line-height: 1.5;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
b, strong { font-weight: 700; }

/* Barra de pantalla */
.toolbar { max-width: 8.5in; margin: 18px auto 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 0 12px; }
.toolbar button { background: ${KC.azul}; color: #fff; border: none; padding: 11px 22px; border-radius: 8px; font: 700 14px Inter, "Segoe UI", sans-serif; cursor: pointer; }
.toolbar span { font-size: 12.5px; color: ${KC.gris}; }

/* Hoja en pantalla */
.hoja { background: #fff; max-width: 8.5in; margin: 0 auto 40px; padding: 0.45in 0.6in 0.5in; box-shadow: 0 6px 30px rgba(23,85,143,.14); }

/* Encabezado y pie */
.enc { display: flex; align-items: center; gap: 12px; padding-bottom: 8px; border-bottom: 1.5px solid ${KC.verde}; }
.enc img { width: 44px; height: 44px; object-fit: contain; }
.enc .sep { width: 1px; align-self: stretch; margin: 3px 2px; background: ${KC.borde}; }
.enc .firma-kc { flex: 1; min-width: 0; line-height: 1.3; }
.enc .rs { font-size: 9.5pt; font-weight: 700; color: ${KC.azulOsc}; }
.enc .lema { font-size: 7.3pt; color: ${KC.grisSuave}; letter-spacing: .02em; }
.enc .doc { text-align: right; line-height: 1.4; padding-left: 12px; border-left: 3px solid ${KC.verde}; }
.enc .doc .t { font-size: 8.3pt; font-weight: 700; color: ${KC.azul}; text-transform: uppercase; letter-spacing: .08em; }
.enc .doc .c { font: 7.3pt Consolas, "Courier New", monospace; color: ${KC.azulOsc}; }
.enc .doc .f { font-size: 7.3pt; color: ${KC.grisSuave}; }
.pie { border-top: 1.5px solid ${KC.azul}; padding-top: 4px; font-size: 6.8pt; color: ${KC.grisSuave}; line-height: 1.45; }
.pie .l2 { display: flex; justify-content: space-between; gap: 12px; }
.pie .c { font-family: Consolas, "Courier New", monospace; color: ${KC.azulOsc}; white-space: nowrap; }
.pie .h { font-weight: 700; color: ${KC.verdeOsc}; }
.marco { width: 100%; border-collapse: collapse; }
.marco > thead, .marco > tfoot { display: none; }
.marco > tbody > tr > td { padding: 0; }

@media print {
  html, body { background: #fff; }
  .toolbar { display: none; }
  .hoja { max-width: none; margin: 0; padding: 0; box-shadow: none; }
  .enc { position: fixed; top: 0; left: 0; right: 0; height: 0.66in; background: #fff; }
  .pie { position: fixed; bottom: 0; left: 0; right: 0; height: 0.36in; background: #fff; }
  .marco > thead { display: table-header-group; }
  .marco > tfoot { display: table-footer-group; }
  .esp-enc { height: 0.82in; }
  .esp-pie { height: 0.46in; }
  .enc-pantalla, .pie-pantalla { display: none; }
}
@media screen { .enc-impresion, .pie-impresion { display: none; } .enc-pantalla { margin-bottom: 18px; } .pie-pantalla { margin-top: 26px; } }

/* Jerarquía */
.portada { background: ${KC.azulOsc}; color: #fff; border-radius: 6px; padding: 18px 22px 16px; border-left: 7px solid ${KC.verde}; break-inside: avoid; }
.portada .ante { font-size: 8pt; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: ${KC.verde}; }
.portada .tit { font-size: 20pt; font-weight: 700; line-height: 1.15; margin-top: 6px; letter-spacing: -.3px; }
.portada .sub { font-size: 10pt; color: #BBD8F2; margin-top: 3px; }
.portada .meta { display: flex; flex-wrap: wrap; gap: 6px 22px; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,.18); font-size: 8.5pt; color: #BBD8F2; }
.portada .meta b { color: #fff; }
h2 { font-size: 13pt; font-weight: 700; color: ${KC.azulOsc}; margin: 22px 0 10px; padding-bottom: 5px; border-bottom: 1px solid ${KC.borde}; break-after: avoid; page-break-after: avoid; }
h2 .n { color: ${KC.verdeOsc}; margin-right: 6px; }
h3 { font-size: 10.5pt; font-weight: 700; color: ${KC.verdeOsc}; margin: 14px 0 6px; break-after: avoid; page-break-after: avoid; }
p { text-align: justify; }
.mono { font-family: Consolas, "Courier New", monospace; font-size: 8pt; color: ${KC.azulOsc}; }
.suave { color: ${KC.grisSuave}; }

/* Tablas: ancho fijo para que nada se salga de la hoja */
table.t { width: 100%; border-collapse: collapse; table-layout: fixed; }
table.t thead { display: table-header-group; }
table.t th { background: ${KC.azul}; color: #fff; font-size: 7.5pt; font-weight: 700; text-align: left; padding: 6px 7px; letter-spacing: .02em; line-height: 1.25; vertical-align: bottom; }
table.t td { font-size: 8.5pt; padding: 6px 7px; border-bottom: 1px solid ${KC.borde}; vertical-align: top; overflow-wrap: anywhere; line-height: 1.45; }
table.t tbody tr:nth-child(even) td { background: ${KC.grisClaro}; }
table.t tr { break-inside: avoid; page-break-inside: avoid; }
table.t .c { text-align: center; }
table.t .r { text-align: right; }

/* Ficha de datos */
table.ficha { width: 100%; border-collapse: collapse; table-layout: fixed; border: 1px solid ${KC.borde}; }
table.ficha td { font-size: 8.5pt; padding: 6px 9px; border-bottom: 1px solid ${KC.borde}; vertical-align: top; overflow-wrap: anywhere; }
table.ficha td.k { width: 17%; background: ${KC.grisClaro}; color: ${KC.azulOsc}; font-weight: 700; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .04em; }

/* Etiquetas y cajas */
.badge { display: inline-block; font-size: 7pt; font-weight: 700; padding: 2px 8px; border-radius: 20px; white-space: nowrap; letter-spacing: .03em; }
.caja { border-left: 5px solid ${KC.azulOsc}; background: ${KC.azulClaro}; border-radius: 0 6px 6px 0; padding: 11px 14px; break-inside: avoid; }
.caja .t { font-size: 8.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 4px; }
.bloque { break-inside: avoid; page-break-inside: avoid; }

/* Cierre: metodología, firmas y leyenda viajan juntas para que las firmas
   nunca queden solas en una página. */
.cierre { break-inside: avoid; page-break-inside: avoid; }
.firmas { display: flex; gap: 28px; margin-top: 18px; }
.firmas > div { flex: 1; text-align: center; font-size: 8.5pt; line-height: 1.45; padding-top: 0.6in; }
.firmas .ln { border-top: 1.2px solid ${KC.azulOsc}; margin-bottom: 6px; }
.firmas .cargo { font-weight: 700; color: ${KC.azulOsc}; }
.leyenda { margin-top: 18px; font-size: 7.5pt; color: ${KC.grisSuave}; text-align: justify; line-height: 1.5; break-inside: avoid; }
`;

/**
 * Envuelve el cuerpo de un documento con encabezado, pie y estilos Kalan.
 * `origen` es la base de URL de la app (de ahí sale el logotipo).
 */
export function documentoHTML({ tituloVentana, tipoDocumento, codigo, referencia = '', origen, cuerpo, css = '' }) {
  const enc = `<div class="enc"><img src="${esc(origen)}/logo-kalan.png" alt="Kalan Consulting"/><div class="sep"></div>
      <div class="firma-kc"><div class="rs">Kalan Consulting, S.A. de C.V.</div><div class="lema">Cumplimiento regulatorio y gestión de riesgo sanitario</div></div>
      <div class="doc"><div class="t">${esc(tipoDocumento)}</div><div class="c">${esc(codigo)}</div>${referencia ? `<div class="f">${esc(referencia)}</div>` : ''}</div></div>`;
  const pie = `<div class="pie"><div>${esc(CONTACTO)}</div><div class="l2"><span class="c">${esc(codigo)}</span><span class="h">#KalanProtege</span></div></div>`;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(tituloVentana)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}${css}</style></head><body>
<div class="toolbar"><button onclick="window.print()">⤓ Imprimir / Guardar como PDF</button>
<span>Destino: «Guardar como PDF» · Tamaño: Carta · Márgenes: predeterminados</span></div>
<div class="hoja">
  <div class="enc-impresion">${enc}</div><div class="enc-impresion">${pie}</div>
  <div class="enc-pantalla">${enc}</div>
  <table class="marco">
    <thead><tr><td><div class="esp-enc"></div></td></tr></thead>
    <tfoot><tr><td><div class="esp-pie"></div></td></tr></tfoot>
    <tbody><tr><td>${cuerpo}</td></tr></tbody>
  </table>
  <div class="pie-pantalla">${pie}</div>
</div></body></html>`;
}
