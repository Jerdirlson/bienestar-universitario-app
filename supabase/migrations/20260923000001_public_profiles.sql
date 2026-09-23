-- Raíz · perfil público (contrato v2 del API)
--
-- Hasta ahora el perfil solo tenía un alias. La comunidad v2 permite seguir a
-- personas y ver su perfil, así que hacen falta: un identificador público
-- corto (para las rutas /users/:publicId), un avatar (emoji + color) y una
-- biografía.
--
-- Lo que NO cambia, y es deliberado: `profiles` sigue dejando leer solo la
-- fila propia (profiles_select_own). Lo público de otras personas se expone
-- con funciones security definer (migración …_public_functions) que devuelven
-- SOLO estas columnas y SOLO de quien eligió un nombre. Abrir `profiles` con
-- una política más permisiva expondría también `role`, `locale` y el `id`
-- interno — y con el `id` se podría cruzar contra `posts.author_id` y
-- desanonimizar publicaciones.
--
-- public_id no es el id interno: es aleatorio, corto, y no dice nada de la
-- cuenta. Nunca sirve para cruzar contra contenido anónimo porque ninguna
-- tabla de contenido lo guarda.
--
-- Escrita para poder aplicarse sobre una base que ya tiene datos: todo con
-- `if not exists` y los perfiles existentes reciben su public_id aquí mismo.

-- Diez caracteres de un alfabeto sin ambigüedades (sin l, o, 0, 1): 32^10
-- combinaciones. Sale de gen_random_uuid(), que es del núcleo de Postgres —
-- no depende de dónde esté instalado pgcrypto (en Supabase vive en el esquema
-- `extensions`, aquí en `public`). Solo se usan los bytes aleatorios del
-- uuid: el 6 y el 8 llevan bits fijos de versión y variante.
create or replace function public.gen_public_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyz23456789';
  raw bytea := uuid_send(gen_random_uuid());
  positions constant int[] := array[0, 1, 2, 3, 4, 5, 10, 11, 12, 13];
  result text := '';
  i int;
begin
  foreach i in array positions loop
    result := result || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

revoke all on function public.gen_public_id() from public;

alter table public.profiles
  add column if not exists public_id    text,
  add column if not exists avatar_emoji text not null default '🌱'
    check (char_length(avatar_emoji) between 1 and 8),
  add column if not exists avatar_color text not null default 'lilac'
    check (avatar_color in ('lilac', 'mint', 'sun', 'peach', 'sky', 'rose')),
  add column if not exists bio          text
    check (char_length(bio) <= 160);

-- Perfiles que ya existían antes de esta migración.
update public.profiles set public_id = public.gen_public_id() where public_id is null;

alter table public.profiles
  alter column public_id set default public.gen_public_id(),
  alter column public_id set not null;

create unique index if not exists profiles_public_id_key on public.profiles (public_id);

comment on column public.profiles.public_id is
  'Identificador público corto y aleatorio para /users/:publicId. No es el id '
  'interno y ninguna tabla de contenido lo guarda. No editable desde el cliente.';

-- Lo que la persona puede editar de su propio perfil. `role` y `public_id`
-- siguen sin permiso de escritura para authenticated.
grant update (avatar_emoji, avatar_color, bio) on public.profiles to authenticated;
