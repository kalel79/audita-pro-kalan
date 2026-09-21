import { registerSW } from 'virtual:pwa-register';

/**
 * Actualización de la app instalada.
 *
 * Cuando hay versión nueva, el service worker la deja en espera y la app
 * avisa. Al aplicarla se guarda primero lo que esté abierto en pantalla
 * (cada pantalla con cambios en memoria registra su guardado) y sólo si todo
 * se guardó se activa la versión nueva y se recarga.
 */

const REVISION_MS = 30 * 60 * 1000;

const oyentes = new Set();
const guardados = new Set();
let hayNueva = false;
let aplicar = null;

export function iniciarActualizaciones() {
  aplicar = registerSW({
    immediate: true,
    onNeedRefresh() {
      hayNueva = true;
      oyentes.forEach((cb) => cb(true));
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      // Sin esto, la versión nueva sólo se detecta al abrir la app; en campo
      // la app se deja abierta todo el día.
      const revisar = () => {
        if (navigator.onLine && !reg.installing) reg.update().catch(() => {});
      };
      setInterval(revisar, REVISION_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revisar();
      });
    },
  });
}

/** Avisa cuando hay una versión nueva lista para aplicarse. */
export function alHaberNuevaVersion(cb) {
  oyentes.add(cb);
  if (hayNueva) cb(true);
  return () => oyentes.delete(cb);
}

/**
 * Una pantalla con cambios en memoria registra aquí cómo guardarlos. La
 * función debe devolver false si no pudo guardar.
 */
export function registrarGuardadoPendiente(fn) {
  guardados.add(fn);
  return () => guardados.delete(fn);
}

/** Guarda lo abierto y aplica la versión nueva. Devuelve false si algo no se guardó. */
export async function aplicarActualizacion() {
  const resultados = await Promise.all([...guardados].map((fn) => (
    Promise.resolve().then(fn).then((r) => r !== false).catch(() => false)
  )));
  if (resultados.includes(false)) return false;
  await aplicar?.(true);
  return true;
}
