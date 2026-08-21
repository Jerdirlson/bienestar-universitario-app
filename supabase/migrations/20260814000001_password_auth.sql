-- Raíz · login por correo y contraseña (cuentas de prueba)
--
-- El login principal es el código de un solo uso (access_codes). Esta es una
-- puerta paralela para cuentas de prueba durante el desarrollo, mientras no
-- hay correo institucional configurado para enviar códigos — no reemplaza el
-- diseño anterior, convive con él.
--
-- password_hash nunca se setea desde una migración: el valor (aunque sea un
-- hash) no debe quedar en el historial de un repositorio público. Se fija con
-- un comando suelto directo contra la base, fuera de git.
--
-- crypt()/gen_salt('bf', ...) son de pgcrypto (ya instalado) — el mismo
-- bcrypt de siempre, sin depender de una librería de Node ni de compilar
-- nada nativo en la imagen de Docker.

alter table auth.users add column password_hash text;

comment on column auth.users.password_hash is
  'bcrypt vía pgcrypto. NULL para cuentas que solo usan el código de correo — '
  'la mayoría. Nunca se setea desde una migración versionada.';

-- Verifica correo + contraseña y devuelve el id si coincide, o null si no.
-- security definer por la misma razón que find_or_create_user(): anon no
-- tiene ningún grant directo sobre auth.users.
create or replace function auth.verify_password(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  stored_hash text;
begin
  select id, password_hash into result_id, stored_hash
    from auth.users where email = p_email;

  if stored_hash is null then
    return null;
  end if;

  -- crypt() vive en public (ahí lo instala pgcrypto) y esta función corre con
  -- search_path = '' — sin calificar, "function crypt(...) does not exist"
  -- aunque la extensión esté creada. Mismo motivo que hmac() en la migración
  -- de access_codes.
  if public.crypt(p_password, stored_hash) = stored_hash then
    update auth.users set last_seen_at = now() where id = result_id;
    return result_id;
  end if;

  return null;
end;
$$;

comment on function auth.verify_password(text, text) is
  'Puerta única para el login con contraseña, igual que find_or_create_user() '
  'para el de código. anon no tiene ningún grant directo sobre auth.users.';

revoke all on function auth.verify_password(text, text) from public;
grant execute on function auth.verify_password(text, text) to anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- GET /me — la única forma de que una sesión ya autenticada vea su correo
-- ─────────────────────────────────────────────────────────────────────────────

-- authenticated tampoco tiene grants sobre auth.users. Esta función solo
-- puede devolver el correo de QUIEN LLAMA — usa auth.uid() por dentro, no
-- recibe un id por parámetro, así que no sirve para consultar el correo de
-- otra persona aunque alguien intentara adaptarla para eso.
create or replace function auth.my_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select email from auth.users where id = auth.uid();
$$;

comment on function auth.my_email() is
  'Correo de la sesión activa, para GET /me. Nunca de otra persona: usa '
  'auth.uid() internamente, no toma un id como argumento.';

revoke all on function auth.my_email() from public;
grant execute on function auth.my_email() to authenticated;
