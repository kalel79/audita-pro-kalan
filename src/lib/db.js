import Dexie from 'dexie';

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

export async function marcarSincronizada(tipo, id) {
  if (tipo === 'auditoria') {
    const a = await db.auditorias.get(id);
    if (a) {
      a.dirty = false;
      a.sincronizada_en = new Date().toISOString();
      await db.auditorias.put(a);
    }
  } else if (tipo === 'hallazgo') {
    const h = await db.hallazgos.get(id);
    if (h) {
      h.dirty = false;
      await db.hallazgos.put(h);
    }
  }
}

export async function limpiarTodo() {
  await db.auditorias.clear();
  await db.hallazgos.clear();
  await db.clientes.clear();
  await db.cola_sync.clear();
}
