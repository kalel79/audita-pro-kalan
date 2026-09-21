import Dexie from 'dexie';
import { mismaVersion } from './fusion';

/**
 * Base de datos local (IndexedDB) para que la app funcione SIN internet.
 * Cuando hay conexión, los registros marcados como "dirty" se sincronizan.
 */
class AuditaProDB extends Dexie {
  constructor() {
    super('audita_pro_kalan');
    this.version(1).stores({
      // ++id auto-incremento, indices secundarios
      auditorias: 'id, folio, fecha, cerrada, dirty, sincronizada_en, auditor_id',
      hallazgos: 'id, auditoria_id, dirty, creado_en',
      clientes: 'id, nombre, dirty',
      cola_sync: '++id, tipo, accion, payload, intentos, creado_en',
    });
  }
}

export const db = new AuditaProDB();

// =================== AUDITORÍAS ===================
export async function guardarAuditoria(aud) {
  aud.dirty = true;
  aud.actualizada_en = new Date().toISOString();
  await db.auditorias.put(aud);
  return aud;
}

export async function listarAuditorias() {
  return await db.auditorias.orderBy('fecha').reverse().toArray();
}

export async function obtenerAuditoria(id) {
  return await db.auditorias.get(id);
}

export async function eliminarAuditoria(id) {
  await db.transaction('rw', db.auditorias, db.hallazgos, db.cola_sync, async () => {
    await db.auditorias.delete(id);
    await db.hallazgos.where('auditoria_id').equals(id).delete();
    await db.cola_sync.add({
      tipo: 'auditoria',
      accion: 'delete',
      payload: { id },
      intentos: 0,
      creado_en: new Date().toISOString(),
    });
  });
}

// =================== HALLAZGOS ===================
export async function guardarHallazgo(h) {
  h.dirty = true;
  await db.hallazgos.put(h);
  return h;
}

export async function listarHallazgosDeAuditoria(auditoriaId) {
  return await db.hallazgos.where('auditoria_id').equals(auditoriaId).toArray();
}

export async function eliminarHallazgo(id) {
  await db.hallazgos.delete(id);
  await db.cola_sync.add({
    tipo: 'hallazgo',
    accion: 'delete',
    payload: { id },
    intentos: 0,
    creado_en: new Date().toISOString(),
  });
}

// =================== CLIENTES ===================
export async function guardarCliente(c) {
  c.dirty = true;
  await db.clientes.put(c);
  return c;
}

export async function listarClientes() {
  return await db.clientes.orderBy('nombre').toArray();
}

// =================== ESTADO DE SINCRONIZACIÓN ===================
export async function contarPendientes() {
  const audSucias = await db.auditorias.filter((a) => !!a.dirty).count();
  const halSucios = await db.hallazgos.filter((h) => !!h.dirty).count();
  const eliminaciones = await db.cola_sync.count();
  return audSucias + halSucios + eliminaciones;
}

/**
 * Confirma que una auditoría llegó al servidor.
 *
 * `selloSubido` es el actualizada_en local de la copia que se subió. Si mientras
 * subía se guardó otro cambio en este dispositivo, el sello ya no coincide y la
 * auditoría sigue pendiente para que el siguiente sync la suba.
 *
 * `fusionada` es la copia combinada cuando hubo conflicto con el servidor: se
 * escribe localmente para que este dispositivo también tenga lo del otro.
 */
export async function confirmarAuditoriaSubida(id, selloSubido, versionServidor, fusionada = null) {
  await db.transaction('rw', db.auditorias, async () => {
    const a = await db.auditorias.get(id);
    if (!a) return;
    if (a.actualizada_en !== selloSubido) {
      // Hay cambios locales más nuevos que lo subido. Si lo subido era una
      // fusión, no se adelanta la versión: así el próximo sync vuelve a
      // combinar en lugar de pisar lo que trajo el otro dispositivo.
      if (!fusionada) {
        a.version_servidor = versionServidor;
        await db.auditorias.put(a);
      }
      return;
    }
    const base = fusionada ? { ...fusionada, actualizada_en: versionServidor } : a;
    await db.auditorias.put({
      ...base,
      dirty: false,
      version_servidor: versionServidor,
      sincronizada_en: new Date().toISOString(),
    });
  });
}

/**
 * Guarda una descarga del servidor sólo si este dispositivo no tiene cambios
 * sin subir. La lectura y la escritura van en una sola transacción para que
 * un autoguardado que ocurra en medio no quede pisado.
 */
export async function aplicarDescarga(remota) {
  return await db.transaction('rw', db.auditorias, async () => {
    const local = await db.auditorias.get(remota.id);
    if (local && (local.dirty || mismaVersion(local.version_servidor, remota.actualizada_en))) return false;
    await db.auditorias.put({
      ...remota,
      dirty: false,
      version_servidor: remota.actualizada_en,
      sincronizada_en: new Date().toISOString(),
    });
    return true;
  });
}

export async function limpiarTodo() {
  await db.auditorias.clear();
  await db.hallazgos.clear();
  await db.clientes.clear();
  await db.cola_sync.clear();
}
