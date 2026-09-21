-- Dictamen y acciones correctivas: sólo admins.
--
-- acciones_correctivas: catálogo de Kalan, una acción por criterio del
--   checklist (giro + id del reactivo). Se guarda el texto del criterio para
--   no precargar una acción equivocada en auditorías hechas con una versión
--   anterior del checklist, donde el mismo id puede ser otro reactivo.
-- dictamenes: lo que el admin ajusta en cada auditoría (acción y plazo por
--   reactivo, conclusiones). No viaja a los dispositivos de los auditores.
--
-- Los consultores no tienen ninguna política sobre estas tablas: RLS les
-- niega todo. Encima aplica la RESTRICTIVE "Requiere cuenta aprobada".

CREATE TABLE IF NOT EXISTS public.acciones_correctivas (
  giro            text        NOT NULL,
  item_id         integer     NOT NULL,
  criterio        text        NOT NULL,
  accion          text        NOT NULL,
  fundamento      text,
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (giro, item_id)
);

CREATE TABLE IF NOT EXISTS public.dictamenes (
  auditoria_id     uuid        PRIMARY KEY REFERENCES public.auditorias(id) ON DELETE CASCADE,
  acciones         jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- { "<item_id>": { "accion": "...", "plazo": "..." } }
  conclusiones     text,
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  actualizado_por  uuid        REFERENCES public.perfiles(id)
);

ALTER TABLE public.acciones_correctivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dictamenes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gestionan acciones correctivas" ON public.acciones_correctivas;
CREATE POLICY "Admins gestionan acciones correctivas" ON public.acciones_correctivas
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "Requiere cuenta aprobada" ON public.acciones_correctivas;
CREATE POLICY "Requiere cuenta aprobada" ON public.acciones_correctivas
  AS RESTRICTIVE FOR ALL USING (public.es_aprobado()) WITH CHECK (public.es_aprobado());

DROP POLICY IF EXISTS "Admins gestionan dictamenes" ON public.dictamenes;
CREATE POLICY "Admins gestionan dictamenes" ON public.dictamenes
  FOR ALL USING (public.es_admin()) WITH CHECK (public.es_admin());

DROP POLICY IF EXISTS "Requiere cuenta aprobada" ON public.dictamenes;
CREATE POLICY "Requiere cuenta aprobada" ON public.dictamenes
  AS RESTRICTIVE FOR ALL USING (public.es_aprobado()) WITH CHECK (public.es_aprobado());

-- Sin acceso para anon, ni siquiera a nivel de privilegios de tabla.
REVOKE ALL ON public.acciones_correctivas FROM anon;
REVOKE ALL ON public.dictamenes FROM anon;

DROP TRIGGER IF EXISTS trg_dictamenes_updated ON public.dictamenes;
CREATE OR REPLACE FUNCTION public.actualizar_dictamen_ts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.actualizado_en = now();
  NEW.actualizado_por = auth.uid();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_dictamenes_updated
  BEFORE INSERT OR UPDATE ON public.dictamenes
  FOR EACH ROW EXECUTE FUNCTION public.actualizar_dictamen_ts();
