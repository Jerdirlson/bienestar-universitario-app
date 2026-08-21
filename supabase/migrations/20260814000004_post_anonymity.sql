-- Raíz · elegir si una publicación es anónima o no
--
-- author_display_name se guarda AL MOMENTO de publicar, en vez de resolverse
-- con un join a profiles cuando se lee. Dos razones, no una:
--
-- 1. profiles solo se puede leer la fila propia (profiles_select_own) — un
--    join a profiles.display_name de OTRA persona no traería nada, RLS lo
--    filtra en la tabla de origen, no en el resultado. Habría que agregar una
--    política nueva y más permisiva sobre profiles para esto, que es peor.
-- 2. Es más predecible: si alguien cambia su nombre después, lo que publicó
--    ayer no cambia de autor retroactivamente.
--
-- No es el correo institucional — sigue siendo el alias de profiles, nunca la
-- identidad real (ver comment de profiles en initial_schema.sql).

alter table public.posts
  add column is_anonymous boolean not null default true,
  add column author_display_name text;

alter table public.posts
  add constraint posts_author_name_consistency
  check (is_anonymous or author_display_name is not null);

comment on column public.posts.author_display_name is
  'Copia de profiles.display_name al momento de publicar. NULL si is_anonymous '
  'es true. No se actualiza si la persona cambia su nombre después.';
