-- ============================================================
--  AUDITA PRO KALAN - Aprobación manual de nuevos usuarios
--  Ejecutar en: Supabase Dashboard > SQL Editor > New Query
--  (después de schema.sql, policies.sql y fix_rls.sql)
-- ============================================================

-- 1. Columna de aprobación: los usuarios nuevos nacen sin aprobar
ALTER TABLE perfiles ADD COLUMN IF NOT EXISTS aprobado BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Función SECURITY DEFINER para evitar recursión en políticas RLS
CREATE OR REPLACE FUNCTION es_aprobado()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = auth.uid() AND aprobado = TRUE
  );
$$;

-- 3. Perfiles existentes quedan aprobados (ya estaban en uso de confianza)
UPDATE perfiles SET aprobado = TRUE;

-- 4. Cuenta administradora: única que puede aprobar nuevos usuarios
UPDATE perfiles SET rol = 'admin', aprobado = TRUE
WHERE email = 'contacto@kalanconsultoria.com';

-- 5. Los admins pueden ver y editar (aprobar) todos los perfiles
DROP POLICY IF EXISTS "Admins editan todos los perfiles" ON perfiles;
CREATE POLICY "Admins editan todos los perfiles" ON perfiles
  FOR UPDATE USING (es_admin());

-- 6. Gatear creación/edición de datos a usuarios aprobados
DROP POLICY IF EXISTS "Crear cliente" ON clientes;
CREATE POLICY "Crear cliente" ON clientes
  FOR INSERT WITH CHECK (creado_por = auth.uid() AND es_aprobado());

DROP POLICY IF EXISTS "Editar propios clientes" ON clientes;
CREATE POLICY "Editar propios clientes" ON clientes
  FOR UPDATE USING (creado_por = auth.uid() AND es_aprobado());

DROP POLICY IF EXISTS "Crear auditoria" ON auditorias;
CREATE POLICY "Crear auditoria" ON auditorias
  FOR INSERT WITH CHECK (auditor_id = auth.uid() AND es_aprobado());

DROP POLICY IF EXISTS "Editar propias auditorias" ON auditorias;
CREATE POLICY "Editar propias auditorias" ON auditorias
  FOR UPDATE USING (auditor_id = auth.uid() AND es_aprobado());

DROP POLICY IF EXISTS "Crear hallazgo" ON hallazgos;
CREATE POLICY "Crear hallazgo" ON hallazgos
  FOR INSERT WITH CHECK (
    es_aprobado() AND
    EXISTS (SELECT 1 FROM auditorias WHERE id = auditoria_id AND auditor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Subir fotos hallazgos" ON storage.objects;
CREATE POLICY "Subir fotos hallazgos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'hallazgos' AND auth.uid() IS NOT NULL AND es_aprobado()
  );

-- Confirmación
SELECT 'Aprobación de usuarios activada. Solo perfiles con aprobado = TRUE pueden operar.' AS resultado;
