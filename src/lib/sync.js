import { supabase, subirFoto } from './supabase';
import { db, marcarSincronizada } from './db';

/**
 * Sincronización offline-first.
 * Estrategia:
 *  1. Sube al servidor todo lo marcado como "dirty" (cambios locales)
 *  2. Descarga del servidor lo que el usuario no tiene aún
 *  3. Procesa la cola de eliminaciones
 */
export async function sincronizar(onProgress = () => {}) {
  if (!navigator.onLine) {
    return { ok: false, mensaje: 'Sin conexión a internet' };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, mensaje: 'Sesión no iniciada' };
  }

  let subidas = 0, descargas = 0, errores = [];

  try {
    // ====== 1. PROCESAR ELIMINACIONES ======
    const eliminaciones = await db.cola_sync.toArray();
    for (const item of eliminaciones) {
      try {
        if (item.tipo === 'auditoria' && item.accion === 'delete') {
          await supabase.from('auditorias').delete().eq('id', item.payload.id);
        } else if (item.tipo === 'hallazgo' && item.accion === 'delete') {
          await supabase.from('hallazgos').delete().eq('id', item.payload.id);
        }
        await db.cola_sync.delete(item.id);
      } catch (e) {
        errores.push(`Eliminación: ${e.message}`);
      }
    }

    // ====== 2. SUBIR AUDITORÍAS LOCALES "DIRTY" ======
    const auditoriasSucias = await db.auditorias.filter(a => a.dirty).toArray();
    onProgress({ fase: 'subiendo_auditorias', total: auditoriasSucias.length, hecho: 0 });

    for (let i = 0; i < auditoriasSucias.length; i++) {
      const aud = auditoriasSucias[i];
      try {
        const payload = {
          id: aud.id,
          folio: aud.folio,
          establecimiento: aud.establecimiento,
          responsable: aud.responsable,
          domicilio: aud.domicilio,
          categoria: aud.categoria,
          giro: aud.giro,
          tramite: aud.tramite,
          normativa: aud.normativa,
          fecha: aud.fecha,
          auditor: aud.auditor,
          auditor_id: user.id,
          cerrada: !!aud.cerrada,
          checklist: aud.checklist,
          pct_cumplimiento: aud.pct_cumplimiento || 0,
          total_criterios: aud.total_criterios || 0,
          criticos_fallidos: aud.criticos_fallidos || 0,
          dictamen_label: aud.dictamen_label || null,
        };

        const { error } = await supabase.from('auditorias').upsert(payload);
        if (error) throw error;
        await marcarSincronizada('auditoria', aud.id);
        subidas++;
      } catch (e) {
        errores.push(`Auditoría ${aud.folio}: ${e.message}`);
      }
      onProgress({ fase: 'subiendo_auditorias', total: auditoriasSucias.length, hecho: i + 1 });
    }

    // ====== 3. SUBIR HALLAZGOS CON FOTOS ======
    const hallazgosSucios = await db.hallazgos.filter(h => h.dirty).toArray();
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
      const local = await db.auditorias.get(remota.id);

      // Solo descargar si no existe localmente, o si la versión remota es más nueva
      // y la local no tiene cambios pendientes
      if (!local || (!local.dirty && new Date(remota.actualizada_en) > new Date(local.actualizada_en || 0))) {
        remota.dirty = false;
        remota.sincronizada_en = new Date().toISOString();
        await db.auditorias.put(remota);
        descargas++;

        // También bajar hallazgos
        const { data: hallazgos } = await supabase
          .from('hallazgos')
          .select('*')
          .eq('auditoria_id', remota.id);

        if (hallazgos) {
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
      mensaje: `Sincronizado: ${subidas} subidas, ${descargas} descargas${errores.length ? `, ${errores.length} errores` : ''}`,
    };
  } catch (e) {
    return { ok: false, mensaje: e.message, errores };
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
