-- ============================================================
--  AUDITA PRO KALAN - Row Level Security (RLS)
--  Ejecutar DESPUÉS de schema.sql
--  
--  Modelo de permisos:
--   - Cada consultor ve y edita SOLO sus propias auditorías y clientes
--   - Los administradores ven todo
--   - Los clientes (sin login) pueden ver dictamenes via token público
-- ============================================================

-- Activar RLS en todas las tablas
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE hallazgos ENABLE ROW LEVEL SECURITY;

-- ============= PERFILES =============
-- Cada usuario lee su propio perfil
CREATE POLICY "Ver propio perfil" ON perfiles
  FOR SELECT USING (auth.uid() = id);

-- Cada usuario actualiza su propio perfil
CREATE POLICY "Editar propio perfil" ON perfiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins ven todos los perfiles
CREATE POLICY "Admins ven todos los perfiles" ON perfiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- ============= CLIENTES =============
-- Consultores ven sus propios clientes
CREATE POLICY "Ver propios clientes" ON clientes
  FOR SELECT USING (creado_por = auth.uid());

-- Crear cliente (cualquier consultor autenticado)
CREATE POLICY "Crear cliente" ON clientes
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND creado_por = auth.uid());

-- Editar propios clientes
CREATE POLICY "Editar propios clientes" ON clientes
  FOR UPDATE USING (creado_por = auth.uid());

-- Eliminar propios clientes
CREATE POLICY "Eliminar propios clientes" ON clientes
  FOR DELETE USING (creado_por = auth.uid());

-- Admins ven todos los clientes
CREATE POLICY "Admins ven todos los clientes" ON clientes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- ============= AUDITORÍAS =============
-- Consultores ven sus propias auditorías
CREATE POLICY "Ver propias auditorias" ON auditorias
  FOR SELECT USING (auditor_id = auth.uid());

-- Crear auditoría
CREATE POLICY "Crear auditoria" ON auditorias
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auditor_id = auth.uid());

-- Editar propias auditorías
CREATE POLICY "Editar propias auditorias" ON auditorias
  FOR UPDATE USING (auditor_id = auth.uid());

-- Eliminar propias auditorías
CREATE POLICY "Eliminar propias auditorias" ON auditorias
  FOR DELETE USING (auditor_id = auth.uid());

-- Admins ven todas las auditorías
CREATE POLICY "Admins ven todas las auditorias" ON auditorias
  FOR ALL USING (
    EXISTS (SELECT 1 FROM perfiles WHERE id = auth.uid() AND rol = 'admin')
  );

-- ACCESO PÚBLICO: cliente final ve dictamen con token
-- (Esto se hace vía función edge, no directamente con RLS)

-- ============= HALLAZGOS =============
-- Ver hallazgos de propias auditorías
CREATE POLICY "Ver hallazgos propios" ON hallazgos
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM auditorias WHERE id = hallazgos.auditoria_id AND auditor_id = auth.uid())
  );

-- Crear hallazgo en propia auditoría
CREATE POLICY "Crear hallazgo" ON hallazgos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM auditorias WHERE id = auditoria_id AND auditor_id = auth.uid())
  );

-- Editar hallazgos de propias auditorías
CREATE POLICY "Editar hallazgos" ON hallazgos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM auditorias WHERE id = hallazgos.auditoria_id AND auditor_id = auth.uid())
  );

-- Eliminar hallazgos de propias auditorías
CREATE POLICY "Eliminar hallazgos" ON hallazgos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM auditorias WHERE id = hallazgos.auditoria_id AND auditor_id = auth.uid())
  );

-- ============================================================
-- STORAGE: política para bucket de hallazgos
-- ============================================================
-- IMPORTANTE: Primero crea el bucket "hallazgos" en:
-- Supabase Dashboard > Storage > New bucket > nombre: "hallazgos" > Public: NO

-- Permitir subir fotos al bucket "hallazgos"
INSERT INTO storage.buckets (id, name, public)
VALUES ('hallazgos', 'hallazgos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Subir fotos hallazgos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'hallazgos' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Leer fotos propias" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'hallazgos' AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Eliminar fotos propias" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'hallazgos' AND auth.uid() = owner
  );

-- Confirmación
SELECT 'Políticas RLS aplicadas correctamente. La base de datos está lista.' AS resultado;
