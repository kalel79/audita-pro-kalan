-- Los admins supervisan el trabajo de todos los auditores.
--
-- En auditorias ya existe "Admins gestionan todas las auditorias" y en
-- storage las fotos de hallazgos ya admiten es_admin(). En hallazgos faltaba,
-- así que un admin veía la auditoría de otro auditor pero no sus hallazgos.
--
-- Los consultores siguen viendo sólo lo suyo: sus políticas no cambian, y la
-- política RESTRICTIVE "Requiere cuenta aprobada" sigue aplicando encima.

drop policy if exists "Admins gestionan todos los hallazgos" on public.hallazgos;

create policy "Admins gestionan todos los hallazgos" on public.hallazgos
  for all
  using (public.es_admin())
  with check (public.es_admin());
