import { supabase, BUCKET } from './supabase';
import { db } from './db';

/**
 * Fotos de hallazgos.
 *
 * El bucket es privado (son evidencias sanitarias), así que no hay URL
 * pública: la foto se guarda en el dispositivo como DataURL (`foto`) y en el
 * servidor en `foto_path`. La pantalla y el dictamen siempre muestran la copia
 * local; si falta (el hallazgo se capturó en otro dispositivo), se descarga
 * con la sesión del usuario, que la base autoriza por dueño de la auditoría.
 */

const LADO_MAX = 1600;
const CALIDAD = 0.8;

/**
 * Reduce la foto de la cámara antes de guardarla. Una foto de tablet pesa
 * varios MB; así queda en unos cientos de KB, que caben bien en el
 * dispositivo y suben rápido con la señal de campo.
 */
export async function comprimirImagen(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', CALIDAD);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Sube la foto de un hallazgo y devuelve su ruta en el bucket. La ruta es fija
 * por hallazgo, así que un reintento después de un sync cortado no duplica
 * el archivo: si ya existe, se toma como subida.
 */
export async function subirFotoHallazgo(h) {
  const blob = await (await fetch(h.foto)).blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const ruta = `${h.auditoria_id}/${h.id}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, blob, { cacheControl: '3600', upsert: false, contentType: blob.type || 'image/jpeg' });
  if (error && !yaExiste(error)) throw error;
  return ruta;
}

function yaExiste(error) {
  return String(error.statusCode) === '409' || /already exists|duplicate/i.test(error.message || '');
}

async function descargarComoDataURL(ruta) {
  const { data, error } = await supabase.storage.from(BUCKET).download(ruta);
  if (error) throw error;
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(data);
  });
}

/**
 * Devuelve la foto del hallazgo lista para mostrar. Si sólo está en el
 * servidor, la descarga y la guarda en el dispositivo para usarla sin conexión.
 * Devuelve null si no hay foto o no se pudo obtener (p. ej. sin internet).
 */
export async function asegurarFotoLocal(h) {
  if (h.foto) return h.foto;
  if (!h.foto_path || !navigator.onLine) return null;
  const foto = await descargarComoDataURL(h.foto_path);
  // Sólo si el hallazgo sigue apuntando a esa misma foto.
  await db.transaction('rw', db.hallazgos, async () => {
    const actual = await db.hallazgos.get(h.id);
    if (actual && actual.foto_path === h.foto_path && !actual.foto) {
      await db.hallazgos.update(h.id, { foto });
    }
  });
  return foto;
}

/** Borra del bucket las fotos indicadas. Sin rutas, no hace nada. */
export async function borrarFotos(rutas) {
  const lista = rutas.filter(Boolean);
  if (!lista.length) return;
  const { error } = await supabase.storage.from(BUCKET).remove(lista);
  if (error) throw error;
}

/** Rutas de todas las fotos de una auditoría (su carpeta en el bucket). */
export async function rutasFotosDeAuditoria(auditoriaId) {
  const { data, error } = await supabase.storage.from(BUCKET).list(auditoriaId, { limit: 1000 });
  if (error) throw error;
  return (data || []).map((o) => `${auditoriaId}/${o.name}`);
}
