import { supabase } from './supabase';

/**
 * Dictamen del admin: acciones correctivas y plazos por reactivo.
 *
 * El catálogo (acciones_correctivas) y los ajustes por auditoría (dictamenes)
 * viven sólo en el servidor y la base se los niega a los consultores, así que
 * aquí no se guarda nada en el dispositivo: se consulta en línea.
 */

export const PLAZOS = ['Inmediato', '15 días', '30 días', '60 días', '90 días'];

/** Plazo por omisión según qué tan grave es el incumplimiento. */
export function plazoSugerido(it) {
  if (it.e === 'no') return { alta: 'Inmediato', media: '30 días', baja: '60 días' }[it.p] || '30 días';
  return { alta: '30 días', media: '60 días', baja: '90 días' }[it.p] || '60 días';
}

export async function cargarCatalogo(giro) {
  const { data, error } = await supabase
    .from('acciones_correctivas')
    .select('item_id, criterio, accion')
    .eq('giro', giro);
  if (error) throw error;
  return new Map(data.map((r) => [r.item_id, r]));
}

export async function cargarAjustes(auditoriaId) {
  const { data, error } = await supabase
    .from('dictamenes')
    .select('acciones')
    .eq('auditoria_id', auditoriaId)
    .maybeSingle();
  if (error) throw error;
  return data?.acciones || {};
}

export async function guardarAjustes(auditoriaId, acciones) {
  const { error } = await supabase
    .from('dictamenes')
    .upsert({ auditoria_id: auditoriaId, acciones });
  if (error) throw error;
}

/**
 * Reactivos que no cumplen o están en proceso, con su acción correctiva.
 *
 * La acción del catálogo sólo se precarga si el texto del reactivo coincide:
 * en auditorías hechas con una versión anterior del checklist el mismo id
 * puede ser otro reactivo, y ahí es preferible dejarla vacía que equivocada.
 */
export function filasCorrectivas(aud, catalogo, ajustes) {
  const filas = [];
  (aud.checklist || []).forEach((s) => (s.i || []).forEach((it) => {
    if (it.e !== 'no' && it.e !== 'proceso') return;
    const cat = catalogo?.get(it.id);
    const deCatalogo = cat && cat.criterio === it.t ? cat.accion : '';
    const aj = ajustes?.[it.id] || {};
    filas.push({
      ...it,
      seccion: s.s,
      accionCatalogo: deCatalogo,
      accion: aj.accion ?? deCatalogo,
      plazo: aj.plazo || plazoSugerido(it),
    });
  }));
  return filas;
}
