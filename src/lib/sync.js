import { supabase, subirFoto } from './supabase';
import { db, confirmarAuditoriaSubida, aplicarDescarga } from './db';
import { fusionarAuditoria, mismaVersion } from './fusion';
import { calcCumplimiento, dictamen } from './utils';

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
          const { error } = await supabase.from(tabla).delete().eq('id', item.payload.id);
          if (error) throw error;
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
          auditor_id: user.id,
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
        let fotoUrl = h.foto_url;
        let fotoPath = h.foto_path;

        // Si la foto está como DataURL local, súbela primero
        if (h.foto && h.foto.startsWith('data:') && !fotoPath) {
          const upload = await subirFoto(h.foto, h.auditoria_id);
          fotoUrl = upload.url;
          fotoPath = upload.path;
        }

        const payload = {
          id: h.id,
          auditoria_id: h.auditoria_id,
          descripcion: h.descripcion || h.desc,
          gravedad: h.gravedad || h.grav,
          foto_url: fotoUrl,
          foto_path: fotoPath,
          creado_por: user.id,
        };

        const { error } = await supabase.from('hallazgos').upsert(payload);
        if (error) throw error;

        // Actualizar localmente con la URL pública
        h.foto_url = fotoUrl;
        h.foto_path = fotoPath;
        h.dirty = false;
        await db.hallazgos.put(h);
        subidas++;
      } catch (e) {
        errores.push(`Hallazgo: ${e.message}`);
      }
      onProgress({ fase: 'subiendo_hallazgos', total: hallazgosSucios.length, hecho: i + 1 });
    }

    // ====== 4. DESCARGAR AUDITORÍAS DEL SERVIDOR ======
    const { data: auditoriasServidor, error: errFetch } = await supabase
      .from('auditorias')
      .select('*')
      .eq('auditor_id', user.id)
      .order('actualizada_en', { ascending: false });

    if (errFetch) throw errFetch;

    onProgress({ fase: 'descargando', total: auditoriasServidor.length, hecho: 0 });

    for (let i = 0; i < auditoriasServidor.length; i++) {
      const remota = auditoriasServidor[i];

      // Sólo se escribe si la copia local no tiene cambios pendientes y la
      // versión del servidor es distinta de la que ya se tiene.
      if (await aplicarDescarga(remota)) {
        descargas++;

        // También bajar hallazgos
        const { data: hallazgos, error: errHal } = await supabase
          .from('hallazgos')
          .select('*')
          .eq('auditoria_id', remota.id);

        if (errHal) {
          errores.push(`Hallazgos de ${remota.folio}: ${errHal.message}`);
        } else {
          for (const hr of hallazgos) {
            hr.dirty = false;
            await db.hallazgos.put(hr);
          }
        }
      }
      onProgress({ fase: 'descargando', total: auditoriasServidor.length, hecho: i + 1 });
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
