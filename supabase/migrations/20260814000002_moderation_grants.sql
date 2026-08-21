-- Raíz · permisos de moderación para service_role
--
-- bypassrls hace que Postgres ignore las POLÍTICAS de seguridad para
-- service_role, pero eso es una capa distinta del sistema de permisos de
-- tabla (GRANT). Sin estos grants, un update como service_role igual falla
-- con "permission denied for table posts" — no es un problema de RLS, es que
-- nadie le dio el permiso de tabla en sí. row_level_security.sql nunca lo
-- hizo porque en ese momento no existía ningún camino que usara service_role
-- todavía.
--
-- Alcance mínimo a propósito: solo lo que moderar necesita, nada de select
-- general ni de otras tablas.

grant update (status, risk, screened_at) on public.posts to service_role;
-- La condición WHERE de la consulta de moderación filtra por id y status,
-- así que hace falta poder leerlas.
grant select (id, status) on public.posts to service_role;

grant insert on public.moderation_actions to service_role;
