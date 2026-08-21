-- Raíz · permisos para que el panel de administración gestione usuarios
--
-- Mismo motivo que moderation_grants.sql: bypassrls salta las políticas,
-- pero no reemplaza el GRANT de tabla. service_role todavía no tenía ni
-- select ni update sobre profiles, ni delete sobre auth.users — nada de eso
-- hacía falta hasta que existió un panel para gestionar cuentas.
--
-- update (role) es de columna, no de tabla completa: el panel puede cambiar
-- el rol de alguien, no su display_name ni nada más — para eso ya existe
-- PATCH /auth/profile, que la propia persona controla.

grant select on public.profiles to service_role;
grant update (role) on public.profiles to service_role;

-- Borrar la cuenta desde auth.users cae en cascada sobre profiles, entries,
-- posts, etc. (on delete cascade, ver initial_schema.sql) — salvo
-- moderation_actions.moderator_id, que es on delete restrict a propósito:
-- una cuenta con historial de moderación no se puede borrar así nomás.
grant delete on auth.users to service_role;
