// Identidad de marca Kalan Consulting
export const K = {
  azul: '#0B3C5D',
  azulCl: '#1E6091',
  verde: '#15803D',
  verdeCl: '#22C55E',
  verdeBr: '#4ADE80',
  arena: '#F4F1EA',
  carbon: '#0F172A',
  gris: '#5B6770',
  negro: '#0A0A0A',
  rojo: '#B3261E',
  amber: '#C99A2E',
};

// Color por categoría sanitaria
export const COLOR_CAT = {
  'Alimentos': '#C0563B',
  'Insumos para la Salud': '#1E6091',
  'Salud Ambiental': '#15803D',
  'Servicios de Salud': '#7A4FA0',
  'Productos y Servicios': '#C99A2E',
  'Disposición de Residuos': '#475569',
  'Control de Tabaco': '#8B3A2E',
};

// Estados de cumplimiento según metodología Kalan
export const ESTADOS = [
  { v: 'cumple', l: 'Cumple', abr: '✓', c: K.verde, val: 1.0 },
  { v: 'proceso', l: 'En proceso', abr: '⚠', c: K.amber, val: 0.5 },
  { v: 'no', l: 'No cumple', abr: '✕', c: K.rojo, val: 0.0 },
  { v: 'na', l: 'N/A', abr: '—', c: K.gris, val: null },
];

/**
 * Calcula porcentaje de cumplimiento de un checklist.
 * Metodología Kalan: Cumple=1.0, EnProceso=0.5, NoCumple=0, N/A excluido.
 */
export function calcCumplimiento(checklist) {
  let suma = 0, total = 0, criticosFallidos = 0, hallazgos = 0, alta = 0;
  checklist.forEach((s) =>
    s.i.forEach((it) => {
      if (it.e === 'na' || it.e === 'pend') return;
      total += 1;
      const est = ESTADOS.find((x) => x.v === it.e);
      if (est && est.val !== null) suma += est.val;
      if (it.e === 'no') {
        hallazgos++;
        if (it.p === 'alta') { alta++; criticosFallidos++; }
      }
    })
  );
  const pct = total === 0 ? 0 : Math.round((suma / total) * 100);
  return { pct, criticosFallidos, hallazgos, alta, total, suma };
}

/**
 * Devuelve el dictamen ejecutivo según los umbrales Kalan.
 */
export function dictamen(pct, criticosFallidos, totalEvaluados) {
  if (totalEvaluados === 0) {
    return {
      label: 'EN REVISIÓN', sub: 'Capture resultados',
      color: K.gris, txt: 'Dictamen pendiente: capture resultados del checklist.',
    };
  }
  if (pct >= 90) {
    return {
      label: 'APROBADO', sub: 'Listo para verificación COFEPRIS',
      color: K.verde,
      txt: `Cumplimiento del ${pct}%. El control sanitario es favorable para verificación COFEPRIS.`,
    };
  }
  if (pct >= 70) {
    return {
      label: 'ATENCIÓN PRIORITARIA', sub: 'Cerrar hallazgos antes de visita oficial',
      color: K.amber,
      txt: `Cumplimiento del ${pct}%. Existen hallazgos que deben cerrarse antes de la visita oficial.`,
    };
  }
  return {
    label: 'RIESGO SANITARIO ALTO', sub: 'Acción correctiva inmediata requerida',
    color: K.rojo,
    txt: `Cumplimiento del ${pct}%. Existen hallazgos críticos o no conformidades que requieren acción correctiva inmediata.`,
  };
}

/**
 * Genera un folio Kalan único.
 */
export function generarFolio() {
  return 'K-' + Date.now().toString(36).toUpperCase().slice(-6);
}

/**
 * Convierte File de input a DataURL (para foto local antes de subir).
 */
export function fileADataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * UUID v4 (para IDs locales antes de sincronizar)
 */
export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
