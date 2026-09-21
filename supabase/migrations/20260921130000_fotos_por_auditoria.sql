-- Fotos de hallazgos: el acceso lo da la auditoría, no quien subió el archivo.
--
-- Las fotos se guardan como <auditoria_id>/<hallazgo_id>.<ext>. Antes se
-- leían y borraban sólo por dueño del objeto (quien lo subió) o admin, así
-- que si un admin agregaba una foto a la auditoría de un auditor, el auditor
-- no la veía. Y cualquier usuario aprobado podía subir a cualquier carpeta.
--
-- Ahora: leer, subir y borrar si la carpeta es una auditoría tuya, o si eres
-- admin. La política RESTRICTIVE "Requiere cuenta aprobada" sigue encima.
-- (Bucket vacío al aplicar esto: 0 objetos.)

CREATE OR REPLACE FUNCTION public.es_auditoria_propia(p_carpeta text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.auditorias
    WHERE id::text = p_carpeta AND auditor_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.es_auditoria_propia(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.es_auditoria_propia(text) TO authenticated;

ALTER POLICY "Leer fotos propias" ON storage.objects
  USING (
    bucket_id = 'hallazgos'
    AND (public.es_admin() OR public.es_auditoria_propia((storage.foldername(name))[1]))
  );

ALTER POLICY "Eliminar fotos propias" ON storage.objects
  USING (
    bucket_id = 'hallazgos'
    AND (public.es_admin() OR public.es_auditoria_propia((storage.foldername(name))[1]))
  );

ALTER POLICY "Subir fotos hallazgos" ON storage.objects
  WITH CHECK (
    bucket_id = 'hallazgos'
    AND (public.es_admin() OR public.es_auditoria_propia((storage.foldername(name))[1]))
  );
