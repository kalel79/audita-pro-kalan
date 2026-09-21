/**
 * Actualización de la app instalada.
 *
 * El service worker nuevo se activa en cuanto se descarga (skipWaiting y
 * clientsClaim). Si en vez de eso se quedara en espera, un dispositivo con
 * la pestaña siempre abierta nunca lo activaría: cerrar la app desde
 * recientes no cierra la pestaña en muchos navegadores Android.
 *
 * Lo que sí se controla es la recarga. El código que ya corre en pantalla
 * sigue funcionando; la app avisa que hay versión nueva y sólo recarga cuando
 * el usuario lo pide, después de guardar lo que esté abierto (cada pantalla
 * con cambios en memoria registra su guardado).
 */

const REVISION_MS = 30 * 60 * 1000;

const oyentes = new Set();
const guardados = new Set();
let hayNueva = false;

export function iniciarActualizaciones() {
  if (!('serviceWorker' in navigator)) return;

  // Sin controlador al cargar = primera instalación: no hay versión vieja.
  const habiaVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaVersion || hayNueva) return;
    hayNueva = true;
    oyentes.forEach((cb) => cb(true));
  });

  const registrar = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      // En campo la app se deja abierta todo el día: se revisa también al
      // volver a primer plano y periódicamente.
      const revisar = () => {
        if (navigator.onLine && !reg.installing) reg.update().catch(() => {});
      };
      setInterval(revisar, REVISION_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') revisar();
      });
    } catch (e) {
      console.error('No se pudo registrar el service worker:', e);
    }
  };
  if (document.readyState === 'complete') registrar();
  else window.addEventListener('load', registrar, { once: true });
}

/** Avisa cuando ya se activó una versión nueva y falta recargar. */
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

/** Guarda lo abierto y recarga con la versión nueva. Devuelve false si algo no se guardó. */
export async function aplicarActualizacion() {
  const resultados = await Promise.all([...guardados].map((fn) => (
    Promise.resolve().then(fn).then((r) => r !== false).catch(() => false)
  )));
  if (resultados.includes(false)) return false;
  window.location.reload();
  return true;
}
