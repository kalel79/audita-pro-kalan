-- ============================================================
--  FIX RLS - Corrige recursión infinita en políticas
--  Ejecutar en SQL Editor de Supabase
-- ============================================================

-- 1. Eliminar políticas problemáticas que generan recursión
DROP POLICY IF EXISTS "Admins ven todos los perfiles" ON perfiles;
DROP POLICY IF EXISTS "Admins ven todos los clientes" ON clientes;
DROP POLICY IF EXISTS "Admins ven todas las auditorias" ON auditorias;

-- 2. Crear función SECURITY DEFINER que rompe la recursión
-- Esta función se ejecuta con privilegios elevados y puede leer
-- perfiles sin disparar las políticas RLS
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = auth.uid() AND rol = 'admin'
  );
$$;

-- 3. Recrear las políticas de admin usando la función segura
CREATE POLICY "Admins ven todos los perfiles" ON perfiles
  FOR SELECT USING (es_admin());

CREATE POLICY "Admins gestionan todos los clientes" ON clientes
  FOR ALL USING (es_admin());

CREATE POLICY "Admins gestionan todas las auditorias" ON auditorias
  FOR ALL USING (es_admin());

-- Confirmación
SELECT 'Políticas RLS corregidas. La recursión infinita debe estar resuelta.' AS resultado;
