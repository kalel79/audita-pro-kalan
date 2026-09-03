-- Parte 3: fotos del bucket privado `hallazgos`.
-- "Leer fotos propias" era (bucket_id='hallazgos' AND auth.uid() IS NOT NULL):
-- cualquier usuario autenticado podia listar y firmar las fotos de TODOS.
-- (Bucket vacio al aplicar esto: 0 objetos, sin riesgo de dejar huerfanos.)

ALTER POLICY "Leer fotos propias" ON storage.objects
  USING (
    bucket_id = 'hallazgos'
    AND (owner = auth.uid() OR owner_id = auth.uid()::text OR public.es_admin())
  );

ALTER POLICY "Eliminar fotos propias" ON storage.objects
  USING (
    bucket_id = 'hallazgos'
    AND (owner = auth.uid() OR owner_id = auth.uid()::text OR public.es_admin())
  );

-- Gate de aprobacion, acotado al bucket para no afectar otros buckets.
DROP POLICY IF EXISTS "Requiere cuenta aprobada" ON storage.objects;
CREATE POLICY "Requiere cuenta aprobada" ON storage.objects
  AS RESTRICTIVE FOR ALL
  USING (bucket_id <> 'hallazgos' OR public.es_aprobado())
  WITH CHECK (bucket_id <> 'hallazgos' OR public.es_aprobado());
