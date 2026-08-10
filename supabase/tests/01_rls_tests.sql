-- Pruebas de Row Level Security.
-- Cada bloque falla ruidosamente si la política NO protege lo que debe.

\set ON_ERROR_STOP on

-- ── Datos de prueba (como service_role, que pasa por encima de RLS) ──────────

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@upb.edu.co'),
  ('22222222-2222-2222-2222-222222222222', 'beto@upb.edu.co'),
  ('33333333-3333-3333-3333-333333333333', 'moderador@upb.edu.co');

update public.profiles set role = 'moderator'
  where id = '33333333-3333-3333-3333-333333333333';

insert into public.entries (user_id, entry_date, mood, feelings, causes, note) values
  ('11111111-1111-1111-1111-111111111111', '2026-08-09', 3, '{tranquile}', '{sueno}', 'diario de Ana'),
  ('22222222-2222-2222-2222-222222222222', '2026-08-09', 1, '{}', '{estudios}', 'diario de Beto');

insert into public.posts (author_id, body, status, risk) values
  ('22222222-2222-2222-2222-222222222222', 'publicacion visible', 'published', 'none'),
  ('22222222-2222-2222-2222-222222222222', 'publicacion en cola', 'pending', 'unscreened');

create or replace function pg_temp.as_ana() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111"}', true);
end $$;

create or replace function pg_temp.as_mod() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    '{"sub":"33333333-3333-3333-3333-333333333333"}', true);
end $$;

-- ── 1. El perfil se creó solo al crear la cuenta ─────────────────────────────
do $$
declare n int;
begin
  select count(*) into n from public.profiles;
  assert n = 3, format('esperaba 3 perfiles autocreados, hay %s', n);
  raise notice 'ok  1  el trigger crea el perfil al registrarse';
end $$;

-- ── 2. Ana solo ve su propio diario ──────────────────────────────────────────
begin;
  select pg_temp.as_ana();
  set local role authenticated;
  do $$
  declare n int; txt text;
  begin
    select count(*) into n from public.entries;
    assert n = 1, format('FUGA: Ana ve %s entradas, debería ver 1', n);
    select note into txt from public.entries;
    assert txt = 'diario de Ana', format('FUGA: Ana lee "%s"', txt);
    raise notice 'ok  2  entries: cada quien ve solo lo suyo';
  end $$;
rollback;

-- ── 3. Ana no puede escribir en el diario de Beto ────────────────────────────
begin;
  select pg_temp.as_ana();
  set local role authenticated;
  do $$
  begin
    begin
      insert into public.entries (user_id, entry_date, mood)
        values ('22222222-2222-2222-2222-222222222222', '2026-08-10', 4);
      raise exception 'FALLO: Ana pudo escribir en el diario de Beto';
    exception when insufficient_privilege then
      raise notice 'ok  3  entries: no se puede escribir a nombre de otro';
    end;
  end $$;
rollback;

-- ── 4. Un moderador TAMPOCO ve diarios ajenos ────────────────────────────────
begin;
  select pg_temp.as_mod();
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.entries;
    assert n = 0, format('FUGA GRAVE: un moderador ve %s diarios ajenos', n);
    raise notice 'ok  4  entries: ni los moderadores leen diarios ajenos';
  end $$;
rollback;

-- ── 5. Nadie puede ascenderse a moderador ────────────────────────────────────
begin;
  select pg_temp.as_ana();
  set local role authenticated;
  do $$
  begin
    begin
      update public.profiles set role = 'admin' where id = auth.uid();
      raise exception 'FALLO: Ana se ascendió a admin';
    exception when insufficient_privilege then
      raise notice 'ok  5  profiles: la columna role no es escribible';
    end;
  end $$;
rollback;

-- ── 6. Nadie puede autopublicar saltándose el filtro ─────────────────────────
begin;
  select pg_temp.as_ana();
  set local role authenticated;
  do $$
  begin
    begin
      insert into public.posts (author_id, body, status, risk)
        values (auth.uid(), 'me salto la moderacion', 'published', 'none');
      raise exception 'FALLO: se pudo publicar sin pasar por moderación';
    exception when insufficient_privilege then
      raise notice 'ok  6  posts: no se puede autopublicar';
    end;
  end $$;
rollback;

-- ── 7. Publicar en estado pendiente sí funciona ──────────────────────────────
begin;
  select pg_temp.as_ana();
  set local role authenticated;
  do $$
  begin
    insert into public.posts (author_id, body) values (auth.uid(), 'hola comunidad');
    raise notice 'ok  7  posts: publicar entra en cola correctamente';
  end $$;
rollback;

-- ── 8. Las publicaciones en cola no son visibles para terceros ───────────────
begin;
  select pg_temp.as_ana();
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.posts;
    assert n = 1, format('FUGA: Ana ve %s publicaciones, solo 1 está publicada', n);
    raise notice 'ok  8  posts: lo pendiente no se filtra al feed';
  end $$;
rollback;

-- ── 9. El moderador sí ve la cola completa ───────────────────────────────────
begin;
  select pg_temp.as_mod();
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.posts;
    assert n = 2, format('el moderador ve %s publicaciones, esperaba 2', n);
    raise notice 'ok  9  posts: el moderador ve la cola';
  end $$;
rollback;

-- ── 10. No se puede reaccionar a algo que no está publicado ──────────────────
begin;
  select pg_temp.as_ana();
  set local role authenticated;
  do $$
  declare pending_id uuid;
  begin
    select id into pending_id from public.posts where body = 'publicacion en cola';
    if pending_id is null then
      raise notice 'ok 10  reactions: la publicación en cola ni siquiera es visible';
      return;
    end if;
    begin
      insert into public.post_reactions (post_id, user_id) values (pending_id, auth.uid());
      raise exception 'FALLO: se reaccionó a una publicación no publicada';
    exception when insufficient_privilege then
      raise notice 'ok 10  reactions: solo sobre publicaciones ya publicadas';
    end;
  end $$;
rollback;

-- ── 11. La bitácora de auditoría es invisible desde el cliente ───────────────
begin;
  select pg_temp.as_mod();
  set local role authenticated;
  do $$
  begin
    begin
      perform count(*) from public.access_audit;
      raise exception 'FALLO: access_audit es legible desde el cliente';
    exception when insufficient_privilege then
      raise notice 'ok 11  access_audit: sin acceso desde el cliente';
    end;
  end $$;
rollback;

-- ── 12. Un registro por persona por día ──────────────────────────────────────
begin;
  select pg_temp.as_ana();
  set local role authenticated;
  do $$
  begin
    begin
      insert into public.entries (user_id, entry_date, mood)
        values (auth.uid(), '2026-08-09', 0);
      raise exception 'FALLO: se permitieron dos check-ins el mismo día';
    exception when unique_violation then
      raise notice 'ok 12  entries: un check-in por día';
    end;
  end $$;
rollback;

\echo ''
\echo '================================'
\echo ' Todas las pruebas RLS pasaron'
\echo '================================'
