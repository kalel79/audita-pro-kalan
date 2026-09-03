-- ============================================================
--  AUDITA PRO KALAN - Cierra la escalada de privilegios en `perfiles`
--  Ejecutar en: Supabase Dashboard > SQL Editor > New Query
--
--  PROBLEMA
--  La politica "Editar propio perfil" es FOR UPDATE USING (auth.uid() = id)
--  sin restriccion de columnas. RLS filtra FILAS, no COLUMNAS: cualquier
--  usuario autenticado podia escribir su propia fila entera, incluidas
--  `rol` y `estado`, y auto-aprobarse como admin desde la consola:
--
--      const { data:{ user } } = await supabase.auth.getUser();
--      await supabase.from('perfiles')
--        .update({ estado:'activo', rol:'admin' }).eq('id', user.id);
--
--  Con signups abiertos y mailer_autoconfirm activo, eso lo podia hacer
--  cualquier persona en internet.
--
--  SOLUCION
--  Un trigger BEFORE UPDATE que rechaza cambios a `rol`/`estado` salvo que
--  el llamador sea admin. Funciona sin importar que politicas RLS existan
--  hoy en la base (el SQL versionado esta desfasado de produccion), y no
--  requiere tocar el frontend: Admin.jsx sigue funcionando igual.
-- ============================================================

-- ── 0. Diagnostico previo (revisa la salida antes de seguir) ─────
SELECT policyname, cmd, qual AS using_expr, with_check
FROM pg_policies WHERE schemaname='public' AND tablename='perfiles'
ORDER BY policyname;

SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='perfiles'
ORDER BY ordinal_position;


-- ── 1. es_admin(): se recrea por si difiere de lo versionado ─────
CREATE OR REPLACE FUNCTION es_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = auth.uid() AND rol = 'admin'
  );
$$;


-- ── 2. El candado: rol y estado solo los cambia un admin ─────────
CREATE OR REPLACE FUNCTION proteger_campos_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No toca campos privilegiados: pasa sin mas (editar nombre, telefono...)
  IF NEW.rol    IS NOT DISTINCT FROM OLD.rol
 AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  -- Si intenta cambiarlos: solo admins autenticados.
  -- auth.uid() IS NULL cubre service_role, el SQL Editor del dashboard,
  -- migraciones y triggers internos, que si deben poder hacerlo.
  IF auth.uid() IS NULL OR es_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'No autorizado: solo un administrador puede cambiar el rol o el estado de un perfil'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_perfil ON perfiles;
CREATE TRIGGER trg_proteger_campos_perfil
BEFORE UPDATE ON perfiles
FOR EACH ROW EXECUTE FUNCTION proteger_campos_perfil();


-- ── 3. Politicas de perfiles, explicitas ─────────────────────────
-- WITH CHECK impide ademas mover la fila a otro id.
DROP POLICY IF EXISTS "Editar propio perfil" ON perfiles;
CREATE POLICY "Editar propio perfil" ON perfiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins editan todos los perfiles" ON perfiles;
CREATE POLICY "Admins editan todos los perfiles" ON perfiles
  FOR UPDATE
  USING (es_admin())
  WITH CHECK (es_admin());

-- Nadie inserta perfiles por API: la fila la crea el trigger
-- crear_perfil_usuario() (SECURITY DEFINER) al registrarse.
DROP POLICY IF EXISTS "Crear propio perfil" ON perfiles;

-- Nadie borra perfiles por API: se van en cascada con auth.users.
DROP POLICY IF EXISTS "Eliminar propio perfil" ON perfiles;


-- ── 4. Que los nuevos usuarios nazcan pendientes, pase lo que pase ──
ALTER TABLE perfiles ALTER COLUMN estado SET DEFAULT 'pendiente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'perfiles_estado_check' AND conrelid = 'perfiles'::regclass
  ) THEN
    ALTER TABLE perfiles ADD CONSTRAINT perfiles_estado_check
      CHECK (estado IN ('pendiente','activo','bloqueado'));
  END IF;
END $$;


-- ── 5. Verificacion ──────────────────────────────────────────────
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'perfiles'::regclass AND NOT tgisinternal;

SELECT estado, count(*) FROM perfiles GROUP BY estado ORDER BY estado;

SELECT 'Escalada de privilegios cerrada. rol/estado ahora solo los cambia un admin.' AS resultado;


-- ============================================================
--  PARTE 2 - El gate de aprobacion tambien debe vivir en la BD
--
--  Bloquear al usuario pendiente solo en App.jsx no sirve: con su JWT
--  puede llamar la API REST directo. Ese gate son las politicas de
--  clientes/auditorias/hallazgos, que llaman es_aprobado()... y esa
--  funcion lee `perfiles.aprobado`, columna que ya NO existe en
--  produccion (verificado: "column perfiles.aprobado does not exist").
--  O sea: o revienta en runtime, o fue reescrita a mano y el repo miente.
-- ============================================================

-- ── 6. es_aprobado() sobre `estado` (idempotente y sin riesgo) ───
CREATE OR REPLACE FUNCTION es_aprobado()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfiles
    WHERE id = auth.uid() AND estado = 'activo'
  );
$$;


-- ── 7. Diagnostico: que politicas existen REALMENTE hoy ──────────
--  NO recreo las politicas de clientes/auditorias/hallazgos a ciegas:
--  si en produccion tienen otros nombres, un DROP+CREATE dejaria dos
--  politicas permisivas conviviendo (se combinan con OR) y el gate
--  quedaria mas debil, no mas fuerte. Revisa esta salida primero.
SELECT tablename, policyname, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('perfiles','clientes','auditorias','hallazgos')
ORDER BY tablename, cmd, policyname;

SELECT policyname, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
