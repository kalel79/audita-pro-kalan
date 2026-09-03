# Migraciones

**Estas migraciones son la fuente de verdad del esquema desde el 2026-09-03.**

Antes de esa fecha el DDL se aplicaba a mano en el SQL Editor del dashboard y
nunca se versiono, asi que los archivos sueltos de `supabase/` (`schema.sql`,
`policies.sql`, `aprobacion_usuarios.sql`, `fix_rls.sql`,
`fix_escalada_privilegios.sql`) estan **desfasados de produccion** y se conservan
solo como historico. No los re-ejecutes: `policies.sql` y `aprobacion_usuarios.sql`
referencian `perfiles.aprobado`, columna que ya no existe (hoy es `perfiles.estado`
con valores `pendiente`/`activo`/`bloqueado`).

Para cambios nuevos, agrega un archivo aqui y aplicalo con el MCP de Supabase
(`apply_migration`) o `supabase db push`. Verifica siempre contra `pg_policies`
antes de tocar RLS.
