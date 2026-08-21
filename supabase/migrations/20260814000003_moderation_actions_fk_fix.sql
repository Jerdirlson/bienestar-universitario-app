-- Raíz · corrige una contradicción en moderation_actions.moderator_id
--
-- initial_schema.sql declaró la columna `not null` pero la llave foránea
-- `on delete set null` — si alguna vez se borra la cuenta de quien moderó
-- algo, Postgres intenta poner NULL para cumplir el ON DELETE y lo rechaza
-- por el NOT NULL, y el borrado entero falla con "violates not-null
-- constraint". Lo encontró la prueba de comunidad al limpiar una cuenta de
-- moderadora de prueba.
--
-- moderation_actions es una bitácora de auditoría append-only (ver comment
-- en la tabla): perder de vista quién hizo una acción de moderación es peor
-- que impedir borrar esa cuenta. `restrict` en vez de `set null` — la cuenta
-- de un moderador con historial queda protegida contra borrado, no se le
-- vacía la identidad al registro.

alter table public.moderation_actions
  drop constraint moderation_actions_moderator_id_fkey,
  add constraint moderation_actions_moderator_id_fkey
    foreign key (moderator_id) references public.profiles (id) on delete restrict;
