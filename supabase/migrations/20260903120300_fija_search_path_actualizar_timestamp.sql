-- Advisor 0011 (function_search_path_mutable).
-- actualizar_timestamp() es SECURITY INVOKER, asi que el riesgo real es bajo,
-- pero fijar el search_path es gratis y cierra el lint.
-- En uso por trg_auditorias_updated sobre auditorias.
ALTER FUNCTION public.actualizar_timestamp() SET search_path = public, pg_temp;
