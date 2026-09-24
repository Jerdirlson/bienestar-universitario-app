-- Pruebas de la revisión de seguridad y privacidad (sep. 2026), sobre los
-- datos que dejó 02_v2_rls_tests.sql. Mismo estilo: cada bloque ATACA la
-- frontera y falla ruidosamente si la base deja pasar algo que no debe.
--
-- Ver supabase/migrations/20260923000010_security_review.sql.

\set ON_ERROR_STOP on

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
end $$;

-- ── 31. Un bloqueo anónimo oculta SOLO su contenido de origen ───────────────
-- Si ocultara todo lo anónimo del autor, bloquear y mirar qué otras cosas
-- anónimas dan 404 diría cuáles son de la misma persona.
begin;
  insert into public.posts (id, author_id, body, status, risk, is_anonymous) values
    ('b0000000-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444',
     'otro escrito sin firma', 'published', 'none', true);
  insert into public.post_comments (id, post_id, author_id, body, status, risk, is_anonymous) values
    ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003',
     '44444444-4444-4444-4444-444444444444', 'comentario anónimo de Ana', 'published', 'none', true);
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  begin
    perform public.block_post_author('b0000000-0000-0000-0000-000000000001');
    assert public.post_hidden_for_me('b0000000-0000-0000-0000-000000000001'),
      'lo bloqueado debería ocultarse';
    assert not public.post_hidden_for_me('b0000000-0000-0000-0000-000000000004'),
      'FUGA: otra publicación anónima del mismo autor se ocultó (agrupa lo anónimo de una persona)';
    assert not public.comment_hidden_for_me('c0000000-0000-0000-0000-000000000004'),
      'FUGA: un comentario anónimo del mismo autor se ocultó';
    raise notice 'ok 31  bloqueos: uno anónimo oculta solo su contenido de origen';
  end $$;
rollback;

-- ── 32. Quien fue bloqueado desde algo anónimo no lo nota ───────────────────
begin;
  -- Beto bloquea desde lo anónimo de Ana.
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  select public.block_post_author('b0000000-0000-0000-0000-000000000001');
  reset role;
  do $$
  begin
    assert not public.named_block_between('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'),
      'FUGA: un bloqueo anónimo cuenta como bloqueo con nombre en sentido contrario';
    assert not public.hides_content('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', false),
      'FUGA: un bloqueo anónimo le oculta a Ana lo firmado de Beto (le dice quién la bloqueó)';
  end $$;
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  declare n int;
  begin
    assert not public.post_hidden_for_me('b0000000-0000-0000-0000-000000000003'),
      'FUGA: Ana deja de ver lo firmado de Beto tras un bloqueo anónimo';
    select count(*) into n from public.public_profile('betov2bbbb');
    assert n = 1, 'FUGA: el perfil de Beto desaparece para Ana tras un bloqueo anónimo';
    raise notice 'ok 32  bloqueos: uno anónimo no se nota del otro lado';
  end $$;
rollback;

-- ── 33. Reaccionar y dar "me gusta" no revelan el alias ─────────────────────
begin;
  insert into public.post_reactions (post_id, user_id, kind) values
    ('b0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'abrazo');
  insert into public.post_comments (id, post_id, author_id, body, status, risk, is_anonymous, author_display_name) values
    ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000003',
     '44444444-4444-4444-4444-444444444444', 'comentario firmado de Ana', 'published', 'none', false, 'Ana V2');
  insert into public.comment_likes (comment_id, user_id) values
    ('c0000000-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555');
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  declare nid uuid;
  begin
    for nid in select id from public.notifications where kind in ('post_reaction', 'comment_like') loop
      assert public.notification_actor(nid) is null,
        format('FUGA: el aviso %s dice quién reaccionó', nid);
    end loop;
    assert (select count(*) from public.notifications where kind in ('post_reaction', 'comment_like')) = 2,
      'debían llegar los dos avisos, sin actor';
    raise notice 'ok 33  notificaciones: reacciones y "me gusta" sin actor';
  end $$;
rollback;

-- ── 34. Lo retirado se lleva sus notificaciones ─────────────────────────────
begin;
  do $$
  declare n int;
  begin
    select count(*) into n from public.notifications where comment_id = 'c0000000-0000-0000-0000-000000000001';
    assert n = 1, format('preparación: debía haber 1 aviso del comentario, hay %s', n);
    update public.post_comments set status = 'removed' where id = 'c0000000-0000-0000-0000-000000000001';
    select count(*) into n from public.notifications where comment_id = 'c0000000-0000-0000-0000-000000000001';
    assert n = 0, 'FALLO: el aviso de un comentario quitado sigue ahí';

    insert into public.post_reactions (post_id, user_id, kind) values
      ('b0000000-0000-0000-0000-000000000003', '44444444-4444-4444-4444-444444444444', 'fuerza');
    select count(*) into n from public.notifications where post_id = 'b0000000-0000-0000-0000-000000000003';
    assert n = 1, 'preparación: la reacción debía avisar';
    update public.posts set status = 'pending', held_reason = 'reports' where id = 'b0000000-0000-0000-0000-000000000003';
    select count(*) into n from public.notifications
      where post_id = 'b0000000-0000-0000-0000-000000000003' and kind = 'post_reaction';
    assert n = 0, 'FALLO: el aviso de una reacción sobre algo ocultado por reportes sigue ahí';
    raise notice 'ok 34  notificaciones: lo rechazado, quitado u oculto no deja avisos';
  end $$;
rollback;

-- ── 35. Registro de publicaciones: append-only y solo lo propio ─────────────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare pid uuid; n int; antes int;
  begin
    -- El candado del límite de frecuencia se puede tomar como authenticated.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

    select count(*) into antes from public.publication_events where user_id = auth.uid() and kind = 'post';
    insert into public.posts (author_id, body) values (auth.uid(), 'cuenta para el límite') returning id into pid;
    delete from public.posts where id = pid;
    select count(*) into n from public.publication_events where user_id = auth.uid() and kind = 'post';
    assert n = antes + 1, format('borrar la publicación no debe borrar su registro (%s → %s)', antes, n);

    select count(*) into n from public.publication_events where user_id <> auth.uid();
    assert n = 0, 'FUGA: se ven registros de otra persona';
    begin
      insert into public.publication_events (user_id, kind) values (auth.uid(), 'post');
      raise exception 'FALLO: se puede escribir el registro desde el cliente';
    exception when insufficient_privilege then null;
    end;
    begin
      delete from public.publication_events where user_id = auth.uid();
      raise exception 'FALLO: se puede borrar el registro desde el cliente';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 35  publication_events: append-only, sin contenido y solo lo propio';
  end $$;
rollback;

\echo ''
\echo '================================'
\echo ' Pruebas de la revisión pasaron'
\echo '================================'
