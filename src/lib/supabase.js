import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'hallazgos';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠ Variables de entorno de Supabase faltantes. Revisa tu archivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Sube una imagen (DataURL) al bucket de Supabase Storage.
 * Devuelve { path, url } o lanza error.
 */
export async function subirFoto(dataUrl, auditoriaId) {
  // Convierte DataURL a Blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.split('/')[1] || 'jpg';
  const filename = `${auditoriaId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, blob, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return { path: data.path, url: urlData.publicUrl };
}

/**
 * Devuelve URL firmada temporal de una foto en Storage.
 * Útil cuando el bucket no es público.
 */
export async function urlFirmadaFoto(path, seconds = 3600) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, seconds);
  if (error) throw error;
  return data.signedUrl;
}
