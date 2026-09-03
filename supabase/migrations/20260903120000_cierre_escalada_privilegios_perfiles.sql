-- Parte 1: rol/estado de un perfil solo los puede cambiar un admin.
-- RLS filtra FILAS, no COLUMNAS: "Editar propio perfil" permitia que
-- cualquier usuario se auto-aprobara con .update({rol:'admin', estado:'activo'}).

CREATE OR REPLACE FUNCTION public.proteger_campos_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No toca campos privilegiados (nombre, telefono, email): pasa.
  IF NEW.rol    IS NOT DISTINCT FROM OLD.rol
 AND NEW.estado IS NOT DISTINCT FROM OLD.estado THEN
    RETURN NEW;
  END IF;

  -- auth.uid() IS NULL cubre service_role, SQL Editor y migraciones.
  IF auth.uid() IS NULL OR public.es_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'No autorizado: solo un administrador puede cambiar el rol o el estado de un perfil'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_campos_perfil ON public.perfiles;
CREATE TRIGGER trg_proteger_campos_perfil
BEFORE UPDATE ON public.perfiles
FOR EACH ROW EXECUTE FUNCTION public.proteger_campos_perfil();

-- Admin.jsx aprueba/bloquea usuarios con el JWT del admin, pero en produccion
-- no existia ninguna politica UPDATE para admins sobre perfiles ajenos.
DROP POLICY IF EXISTS "Admins editan todos los perfiles" ON public.perfiles;
CREATE POLICY "Admins editan todos los perfiles" ON public.perfiles
  FOR UPDATE
  USING (public.es_admin())
  WITH CHECK (public.es_admin());

-- WITH CHECK explicito: impide mover la fila a otro id.
ALTER POLICY "Editar propio perfil" ON public.perfiles
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Nadie inserta perfiles por API: la fila la crea crear_perfil_usuario()
-- (SECURITY DEFINER, owner postgres => bypassa RLS). WITH CHECK (true)
-- dejaba insertar filas arbitrarias a cualquiera.
DROP POLICY IF EXISTS "Permitir insercion via trigger" ON public.perfiles;

ALTER TABLE public.perfiles ALTER COLUMN estado SET DEFAULT 'pendiente';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'perfiles_estado_check' AND conrelid = 'public.perfiles'::regclass
  ) THEN
    ALTER TABLE public.perfiles ADD CONSTRAINT perfiles_estado_check
      CHECK (estado IN ('pendiente','activo','bloqueado'));
  END IF;
END $$;
