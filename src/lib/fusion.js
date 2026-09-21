/**
 * Combinación de dos versiones de una misma auditoría.
 *
 * Se usa cuando la copia local y la del servidor cambiaron por separado
 * (dos dispositivos, o una copia vieja que quedó sin sincronizar). En vez
 * de que una pise a la otra, se conserva todo lo capturado en ambas:
 *  - Un reactivo evaluado le gana a uno pendiente. La interfaz no permite
 *    regresar un reactivo a 'pend', así que esto nunca revierte una decisión.
 *  - Si los dos están evaluados y difieren, gana `preferida`.
 *  - Una observación escrita le gana a una vacía.
 *  - Las filas de los anexos se unen por su _id.
 */

const CAMPOS_TEXTO = [
  'establecimiento', 'responsable', 'domicilio', 'categoria', 'giro',
  'tramite', 'normativa', 'fecha', 'auditor', 'folio',
];

export function fusionarAuditoria(preferida, otra) {
  const out = { ...otra, ...preferida };
  for (const k of CAMPOS_TEXTO) {
    if (!preferida[k] && otra[k]) out[k] = otra[k];
  }
  out.cerrada = !!(preferida.cerrada || otra.cerrada);
  out.checklist = fusionarChecklist(preferida.checklist || [], otra.checklist || []);
  return out;
}

export function fusionarChecklist(preferida, otra) {
  const otraPorSec = new Map(otra.map((s) => [s.s, s]));
  const out = preferida.map((sec) => {
    const o = otraPorSec.get(sec.s);
    if (!o) return sec;
    const otrosItems = new Map((o.i || []).map((it) => [it.id, it]));
    return {
      ...sec,
      i: (sec.i || []).map((it) => fusionarItem(it, otrosItems.get(it.id))),
      ...(sec.anexo || o.anexo ? { anexo: fusionarAnexo(sec.anexo, o.anexo) } : {}),
    };
  });
  const titulos = new Set(preferida.map((s) => s.s));
  for (const o of otra) if (!titulos.has(o.s)) out.push(o);
  return out;
}

function fusionarItem(it, o) {
  if (!o) return it;
  return {
    ...it,
    e: it.e === 'pend' ? o.e : it.e,
    o: it.o || o.o || '',
  };
}

function fusionarAnexo(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = { ...b, ...a };
  for (const m of a.meta || []) {
    if (!a[m.k] && b[m.k]) out[m.k] = b[m.k];
  }
  const filasA = a.filas || [];
  const filasB = b.filas || [];
  if (filasA.length === 0) {
    out.filas = filasB;
  } else {
    // Sin _id no hay forma de saber si una fila es la misma; esas se quedan
    // sólo en la versión donde estén para no duplicarlas en cada fusión.
    const ids = new Set(filasA.map((f) => f._id).filter(Boolean));
    out.filas = [...filasA, ...filasB.filter((f) => f._id && !ids.has(f._id))];
  }
  return out;
}

/** Compara dos timestamps del servidor sin depender del formato del texto. */
export function mismaVersion(a, b) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}
