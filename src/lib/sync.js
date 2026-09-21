import { supabase } from './supabase';
import { db, confirmarAuditoriaSubida, aplicarDescarga, quitarAusentesDelServidor, aplicarHallazgosDelServidor } from './db';
import { subirFotoHallazgo, asegurarFotoLocal, borrarFotos, rutasFotosDeAuditoria } from './fotos';
import { fusionarAuditoria, mismaVersion } from './fusion';
import { calcCumplimiento, dictamen } from './utils';

const PAGINA = 1000;

/**
 * Sincronización offline-first.
 * Estrategia:
 *  1. Procesa la cola de eliminaciones
 *  2. Sube las auditorías con cambios locales ("dirty"). Si el servidor cambió
 *     desde la última vez que este dispositivo lo vio, combina ambas versiones
 *     en lugar de pisar la del servidor.
 *  3. Sube hallazgos con fotos
 *  4. Descarga lo que cambió en el servidor, sin tocar copias con cambios locales
 */

// Un solo sync a la vez: al abrir la app, al volver la conexión y el botón
// pueden dispararse juntos, y dos subidas cruzadas se pisan entre sí.
let enCurso = null;
const oyentes = new Set();

export function sincronizar(onProgress = () => {}) {
  if (!enCurso) {
    enCurso = ejecutar(onProgress)
      .then((res) => {
        oyentes.forEach((cb) => cb(res));
        return res;
      })
      .finally(() => { enCurso = null; });
  }
  return enCurso;
}

/** Avisa el resultado de cada sync, incluidos los automáticos. */
export function alSincronizar(cb) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

async function ejecutar(onProgress) {
  if (!navigator.onLine) {
    return { ok: false, sinConexion: true, errores: [], mensaje: 'Sin conexión a internet' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, errores: [], mensaje: 'Sesión no iniciada' };
  }

  let subidas = 0, descargas = 0;
  const errores = [];
  const combinadas = [];

  try {
    // ====== 1. PROCESAR ELIMINACIONES ======
    const eliminaciones = await db.cola_sync.toArray();
    for (const item of eliminaciones) {
      try {
        const tabla = item.tipo === 'auditoria' ? 'auditorias' : item.tipo === 'hallazgo' ? 'hallazgos' : null;
        if (tabla && item.accion === 'delete') {
          // Las fotos de una auditoría se borran antes que la auditoría: el
          // permiso sobre la carpeta depende de que la auditoría exista.
          if (item.tipo === 'auditoria') {
            await borrarFotos(await rutasFotosDeAuditoria(item.payload.id));
          }
          const { error } = await supabase.from(tabla).delete().eq('id', item.payload.id);
          if (error) throw error;
          if (item.tipo === 'hallazgo' && item.payload.foto_path) {
            await borrarFotos([item.payload.foto_path]);
          }
        }
        await db.cola_sync.delete(item.id);
      } catch (e) {
        errores.push(`Eliminación: ${e.message}`);
      }
    }

    // ====== 2. SUBIR AUDITORÍAS LOCALES "DIRTY" ======
    const auditoriasSucias = await db.auditorias.filter((a) => a.dirty).toArray();
    onProgress({ fase: 'subiendo_auditorias', total: auditoriasSucias.length, hecho: 0 });

    const versionesServidor = new Map();
    if (auditoriasSucias.length) {
      const { data: vs, error } = await supabase
        .from('auditorias')
        .select('id, actualizada_en')
        .in('id', auditoriasSucias.map((a) => a.id));
      if (error) throw error;
      vs.forEach((v) => versionesServidor.set(v.id, v.actualizada_en));
    }

    for (let i = 0; i < auditoriasSucias.length; i++) {
      const aud = auditoriasSucias[i];
      try {
        let aSubir = aud;
        let fusionada = null;
        const vServidor = versionesServidor.get(aud.id);

        // La auditoría existe en el servidor y cambió desde la versión en la
        // que se basa esta copia (otro dispositivo, o una copia vieja que no
        // se había sincronizado). Se combinan en vez de pisarla.
        if (vServidor && !mismaVersion(vServidor, aud.version_servidor)) {
          const { data: remota, error } = await supabase
            .from('auditorias').select('*').eq('id', aud.id).single();
          if (error) throw error;
          fusionada = fusionarAuditoria(aud, remota);
          const r = calcCumplimiento(fusionada.checklist || []);
          fusionada.pct_cumplimiento = r.pct;
          fusionada.total_criterios = r.total;
          fusionada.criticos_fallidos = r.criticosFallidos;
          fusionada.dictamen_label = dictamen(r.pct, r.criticosFallidos, r.total).label;
          aSubir = fusionada;
          combinadas.push(aud.folio || aud.establecimiento);
        }

        const payload = {
          id: aSubir.id,
          folio: aSubir.folio,
          establecimiento: aSubir.establecimiento,
          responsable: aSubir.responsable,
          domicilio: aSubir.domicilio,
          categoria: aSubir.categoria,
          giro: aSubir.giro,
          tramite: aSubir.tramite,
          normativa: aSubir.normativa,
          fecha: aSubir.fecha,
          auditor: aSubir.auditor,
          // Se conserva el dueño: si un admin edita la auditoría de otro
          // auditor, sigue siendo de ese auditor.
          auditor_id: aSubir.auditor_id || user.id,
          cerrada: !!aSubir.cerrada,
          checklist: aSubir.checklist,
          pct_cumplimiento: aSubir.pct_cumplimiento || 0,
          total_criterios: aSubir.total_criterios || 0,
          criticos_fallidos: aSubir.criticos_fallidos || 0,
          dictamen_label: aSubir.dictamen_label || null,
        };

        const { data: fila, error } = await supabase
          .from('auditorias').upsert(payload).select('actualizada_en').single();
        if (error) throw error;
        await confirmarAuditoriaSubida(aud.id, aud.actualizada_en, fila.actualizada_en, fusionada);
        subidas++;
      } catch (e) {
        errores.push(`Auditoría ${aud.folio || aud.establecimiento}: ${e.message}`);
      }
      onProgress({ fase: 'subiendo_auditorias', total: auditoriasSucias.length, hecho: i + 1 });
    }

    // ====== 3. SUBIR HALLAZGOS CON FOTOS ======
    const hallazgosSucios = await db.hallazgos.filter((h) => h.dirty).toArray();
    onProgress({ fase: 'subiendo_hallazgos', total: hallazgosSucios.length, hecho: 0 });

    for (let i = 0; i < hallazgosSucios.length; i++) {
      const h = hallazgosSucios[i];
      try {
        let fotoPath = h.foto_path;

        // La foto sube primero y su ruta se guarda de inmediato: si el sync
        // se corta antes de registrar el hallazgo, el reintento no la resube.
        if (h.foto && h.foto.startsWith('data:') && !fotoPath) {
          fotoPath = await subirFotoHallazgo(h);
          await db.hallazgos.update(h.id, { foto_path: fotoPath });
        }

        const payload = {
          id: h.id,
          auditoria_id: h.auditoria_id,
          descripcion: h.descripcion || h.desc,
          gravedad: h.gravedad || h.grav,
          // El bucket es privado: no hay URL pública que guardar.
          foto_url: null,
          foto_path: fotoPath || null,
          creado_por: h.creado_por || user.id,
        };

        const { error } = await supabase.from('hallazgos').upsert(payload);
        if (error) throw error;

        await db.hallazgos.update(h.id, { foto_path: fotoPath || null, dirty: false });
        subidas++;
      } catch (e) {
        errores.push(`Hallazgo: ${e.message}`);
      }
      onProgress({ fase: 'subiendo_hallazgos', total: hallazgosSucios.length, hecho: i + 1 });
    }

    // ====== 4. DESCARGAR AUDITORÍAS DEL SERVIDOR ======
    // Sin filtro por auditor: RLS decide. Un consultor recibe sólo las suyas;
    // un admin recibe las de todos los auditores.
    // Por páginas, porque la API corta en 1000 filas y abajo se usa la lista
    // completa para saber qué se borró en el servidor.
    const auditoriasServidor = [];
    for (let desde = 0; ; desde += PAGINA) {
      const { data: pagina, error: errFetch } = await supabase
        .from('auditorias')
        .select('*')
        .order('id')
        .range(desde, desde + PAGINA - 1);
      if (errFetch) throw errFetch;
      auditoriasServidor.push(...pagina);
      if (pagina.length < PAGINA) break;
    }

    onProgress({ fase: 'descargando', total: auditoriasServidor.length, hecho: 0 });

    for (let i = 0; i < auditoriasServidor.length; i++) {
      const remota = auditoriasServidor[i];

      // Sólo se escribe si la copia local no tiene cambios pendientes y la
      // versión del servidor es distinta de la que ya se tiene.
      if (await aplicarDescarga(remota)) descargas++;
      onProgress({ fase: 'descargando', total: auditoriasServidor.length, hecho: i + 1 });
    }

    // Lo que ya no está en el servidor se borró desde otro dispositivo (o ya
    // no le corresponde a esta cuenta). Se quita de aquí, salvo que tenga
    // cambios sin subir.
    await quitarAusentesDelServidor(auditoriasServidor.map((a) => a.id));

    // ====== 5. DESCARGAR HALLAZGOS DEL SERVIDOR ======
    // Van aparte de las auditorías: agregar un hallazgo no cambia la versión
    // de su auditoría, así que bajarlos sólo cuando la auditoría cambiaba
    // hacía que los hallazgos nuevos de otro dispositivo nunca llegaran.
    const hallazgosServidor = [];
    for (let desde = 0; ; desde += PAGINA) {
      const { data: pagina, error: errHal } = await supabase
        .from('hallazgos')
        .select('*')
        .order('id')
        .range(desde, desde + PAGINA - 1);
      if (errHal) throw errHal;
      hallazgosServidor.push(...pagina);
      if (pagina.length < PAGINA) break;
    }
    await aplicarHallazgosDelServidor(hallazgosServidor);

    // Fotos que este dispositivo todavía no tiene, para verlas sin conexión.
    // Un fallo aquí no detiene el sync: se reintenta al abrir el hallazgo o
    // en el siguiente sync.
    const sinFoto = await db.hallazgos.filter((h) => !!h.foto_path && !h.foto).toArray();
    for (const h of sinFoto) {
      try {
        await asegurarFotoLocal(h);
      } catch (e) {
        errores.push(`Foto de hallazgo: ${e.message}`);
      }
    }

    onProgress({ fase: 'completo' });
    return {
      ok: true,
      subidas,
      descargas,
      errores,
      combinadas,
      mensaje: `Sincronizado: ${subidas} subidas, ${descargas} descargas${errores.length ? `, ${errores.length} errores` : ''}`,
    };
  } catch (e) {
    return { ok: false, mensaje: e.message, errores, combinadas };
  }
}

/**
 * Auto-sincronización cuando se recupera la conexión
 */
export function iniciarAutoSync(callback) {
  const handler = async () => {
    if (navigator.onLine) {
      const res = await sincronizar();
      callback?.(res);
    }
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
