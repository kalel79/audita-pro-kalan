-- Parte 2: el gate de aprobacion vive en la BD, no solo en App.jsx.
-- Un usuario 'pendiente' tiene JWT valido y puede llamar la API REST directo.

CREATE OR REPLACE FUNCTION public.es_aprobado()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND estado = 'activo'
  );
$$;

-- RESTRICTIVE se combina con AND sobre las politicas permisivas existentes:
-- no las toca, no las puede debilitar, y no depende de sus nombres.
-- (es_admin() ya exige estado='activo', asi que un admin siempre es aprobado.)

DROP POLICY IF EXISTS "Requiere cuenta aprobada" ON public.clientes;
CREATE POLICY "Requiere cuenta aprobada" ON public.clientes
  AS RESTRICTIVE FOR ALL
  USING (public.es_aprobado())
  WITH CHECK (public.es_aprobado());

DROP POLICY IF EXISTS "Requiere cuenta aprobada" ON public.auditorias;
CREATE POLICY "Requiere cuenta aprobada" ON public.auditorias
  AS RESTRICTIVE FOR ALL
  USING (public.es_aprobado())
  WITH CHECK (public.es_aprobado());

DROP POLICY IF EXISTS "Requiere cuenta aprobada" ON public.hallazgos;
CREATE POLICY "Requiere cuenta aprobada" ON public.hallazgos
  AS RESTRICTIVE FOR ALL
  USING (public.es_aprobado())
  WITH CHECK (public.es_aprobado());
