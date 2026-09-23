-- Pruebas de seguridad de la comunidad v2 y del diario libre.
-- Mismo estilo que 01_rls_tests.sql: cada bloque ATACA la frontera y falla
-- ruidosamente si la base deja pasar algo que no debe.

\set ON_ERROR_STOP on

-- ── Datos de prueba (como superusuario, que pasa por encima de RLS) ─────────

insert into auth.users (id, email) values
  ('44444444-4444-4444-4444-444444444444', 'v2-ana@upb.edu.co'),
  ('55555555-5555-5555-5555-555555555555', 'v2-beto@upb.edu.co'),
  ('66666666-6666-6666-6666-666666666666', 'v2-admin@upb.edu.co'),
  ('77777777-7777-7777-7777-777777777777', 'v2-sin-nombre@upb.edu.co'),
  ('88888888-8888-8888-8888-888888888888', 'v2-mod@upb.edu.co');

update public.profiles set display_name = 'Ana V2', public_id = 'anav2aaaaa'
  where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set display_name = 'Beto V2', public_id = 'betov2bbbb'
  where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set role = 'admin'
  where id = '66666666-6666-6666-6666-666666666666';
update public.profiles set public_id = 'sinnombrex'
  where id = '77777777-7777-7777-7777-777777777777';
update public.profiles set role = 'moderator'
  where id = '88888888-8888-8888-8888-888888888888';

insert into public.journal_entries (id, user_id, body) values
  ('a0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'diario libre de Ana'),
  ('a0000000-0000-0000-0000-000000000002', '55555555-5555-5555-5555-555555555555', 'diario libre de Beto');

insert into public.entries (user_id, entry_date, mood, note) values
  ('44444444-4444-4444-4444-444444444444', '2026-09-20', 3, 'check-in de Ana');

-- Ana publica una cosa anónima y una con nombre; ambas publicadas.
insert into public.posts (id, author_id, body, status, risk, is_anonymous, author_display_name) values
  ('b0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'escrito sin firma', 'published', 'none', true, null),
  ('b0000000-0000-0000-0000-000000000002', '44444444-4444-4444-4444-444444444444', 'firmado por Ana', 'published', 'none', false, 'Ana V2'),
  ('b0000000-0000-0000-0000-000000000003', '55555555-5555-5555-5555-555555555555', 'de Beto', 'published', 'none', false, 'Beto V2');

-- Beto comenta ANÓNIMO en la publicación con nombre de Ana: dispara la
-- notificación a Ana, que no debe decir quién fue.
insert into public.post_comments (id, post_id, author_id, body, status, risk, is_anonymous) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002',
   '55555555-5555-5555-5555-555555555555', 'comentario anónimo de Beto', 'published', 'none', true);

insert into public.saved_posts (user_id, post_id) values
  ('44444444-4444-4444-4444-444444444444', 'b0000000-0000-0000-0000-000000000003');

insert into public.blocks (blocker_id, blocked_id, label) values
  ('44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777', 'alguien');

insert into public.follows (follower_id, followee_id) values
  ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');

insert into public.comment_reports (comment_id, reporter_id, reason) values
  ('c0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'other');

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
end $$;

-- ── 13. Diario libre: cada quien ve solo lo suyo ─────────────────────────────
begin;
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  declare n int; txt text;
  begin
    select count(*) into n from public.journal_entries;
    assert n = 1, format('FUGA: Ana ve %s entradas del diario libre, debería ver 1', n);
    select body into txt from public.journal_entries;
    assert txt = 'diario libre de Ana', format('FUGA: Ana lee "%s"', txt);
    raise notice 'ok 13  journal_entries: cada quien ve solo lo suyo';
  end $$;
rollback;

-- ── 14. Ni moderador ni administrador leen diarios ajenos (ninguno de los dos)
begin;
  select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.journal_entries;
    assert n = 0, format('FUGA GRAVE: un administrador ve %s entradas del diario libre', n);
    select count(*) into n from public.entries;
    assert n = 0, format('FUGA GRAVE: un administrador ve %s check-ins ajenos', n);
    raise notice 'ok 14  diario: un administrador no lee diarios ajenos';
  end $$;
rollback;

begin;
  select pg_temp.as_user('88888888-8888-8888-8888-888888888888');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.journal_entries;
    assert n = 0, format('FUGA GRAVE: un moderador ve %s entradas del diario libre', n);
    raise notice 'ok 15  diario: un moderador tampoco';
  end $$;
rollback;

-- ── 16. No se escribe ni se pisa el diario libre de otra persona ─────────────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare n int;
  begin
    begin
      insert into public.journal_entries (id, user_id, body)
        values (gen_random_uuid(), '44444444-4444-4444-4444-444444444444', 'escrito por Beto');
      raise exception 'FALLO: Beto escribió en el diario de Ana';
    exception when insufficient_privilege then null;
    end;
    -- Mismo id que una entrada de Ana: el upsert no puede tomar su fila.
    begin
      insert into public.journal_entries (id, user_id, body)
        values ('a0000000-0000-0000-0000-000000000001', auth.uid(), 'pisado')
        on conflict (id) do update set body = excluded.body;
      raise exception 'FALLO: Beto pisó una entrada de Ana con un upsert';
    exception when insufficient_privilege then null;
    end;
    update public.journal_entries set body = 'pisado' where id = 'a0000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    assert n = 0, 'FALLO: Beto editó una entrada de Ana';
    delete from public.journal_entries where id = 'a0000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    assert n = 0, 'FALLO: Beto borró una entrada de Ana';
    raise notice 'ok 16  journal_entries: no se escribe, pisa ni borra lo ajeno';
  end $$;
rollback;

-- ── 17. service_role no tiene ningún permiso sobre el diario ─────────────────
begin;
  set local role service_role;
  do $$
  begin
    begin
      perform count(*) from public.journal_entries;
      raise exception 'FALLO: service_role puede leer journal_entries';
    exception when insufficient_privilege then null;
    end;
    begin
      perform count(*) from public.entries;
      raise exception 'FALLO: service_role puede leer entries';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 17  diario: ni service_role lo lee';
  end $$;
rollback;

-- ── 18. Guardados, seguimientos y bloqueos: nadie ve los de otra persona ─────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.saved_posts;
    assert n = 0, format('FUGA: Beto ve %s guardados ajenos', n);
    select count(*) into n from public.blocks;
    assert n = 0, format('FUGA: Beto ve %s bloqueos ajenos', n);
    -- Beto es seguido por Ana, pero la fila es "de" Ana: no la ve.
    select count(*) into n from public.follows;
    assert n = 0, format('FUGA: Beto ve %s seguimientos ajenos', n);
    raise notice 'ok 18  saved/blocks/follows: nadie ve los de otra persona';
  end $$;
rollback;

begin;
  select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.saved_posts;
    assert n = 0, format('FUGA: un administrador ve %s guardados ajenos', n);
    select count(*) into n from public.blocks;
    assert n = 0, format('FUGA: un administrador ve %s bloqueos ajenos', n);
    select count(*) into n from public.notifications;
    assert n = 0, format('FUGA: un administrador ve %s notificaciones ajenas', n);
    raise notice 'ok 19  saved/blocks/notifications: tampoco un administrador';
  end $$;
rollback;

-- ── 20. Ni siquiera quien bloquea puede leer A QUIÉN bloqueó ─────────────────
begin;
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  begin
    begin
      perform blocked_id from public.blocks;
      raise exception 'FALLO: blocked_id es legible desde el cliente';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.blocks (blocker_id, blocked_id, label)
        values (auth.uid(), '55555555-5555-5555-5555-555555555555', 'x');
      raise exception 'FALLO: se puede insertar un bloqueo sin pasar por las funciones';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.follows (follower_id, followee_id)
        values ('55555555-5555-5555-5555-555555555555', auth.uid());
      raise exception 'FALLO: se puede insertar un seguimiento directo (y a nombre de otro)';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 20  blocks/follows: blocked_id oculto y sin insert directo';
  end $$;
rollback;

-- ── 21. Notificaciones: solo las propias, y nunca quién actuó en anónimo ─────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare n int;
  begin
    -- Beto tiene su propio aviso (Ana lo sigue); lo que no puede es ver o
    -- tocar los de Ana.
    select count(*) into n from public.notifications where recipient_id <> auth.uid();
    assert n = 0, format('FUGA: Beto ve %s notificaciones ajenas', n);
    update public.notifications set read_at = now() where recipient_id <> auth.uid();
    get diagnostics n = row_count;
    assert n = 0, 'FALLO: Beto marcó como leídas notificaciones ajenas';
    begin
      insert into public.notifications (recipient_id, kind) values (auth.uid(), 'new_follower');
      raise exception 'FALLO: se pueden fabricar notificaciones desde el cliente';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 21  notifications: nadie ve, marca ni fabrica las de otra persona';
  end $$;
rollback;

begin;
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  declare n int; card jsonb; nid uuid;
  begin
    select count(*), min(id::text)::uuid into n, nid from public.notifications where kind = 'post_comment';
    assert n = 1, format('Ana debía tener 1 aviso de comentario, tiene %s', n);
    card := public.notification_actor(nid);
    assert card is null, format('FUGA: el aviso de un comentario anónimo revela a %s', card);
    begin
      perform actor_id from public.notifications;
      raise exception 'FALLO: actor_id es legible desde el cliente';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 22  notifications: un comentario anónimo no revela a su autor';
  end $$;
rollback;

-- ── 23. Lo anónimo no filtra su autor por ninguna función pública ────────────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare n int; card jsonb; cnt int;
  begin
    card := public.post_author('b0000000-0000-0000-0000-000000000001');
    assert card is null, format('FUGA: post_author revela al autor de algo anónimo: %s', card);
    card := public.post_author('b0000000-0000-0000-0000-000000000002');
    assert card ->> 'public_id' = 'anav2aaaaa', 'post_author debería firmar lo firmado';
    assert not (card ? 'id'), 'FUGA: la tarjeta pública lleva el id interno';

    card := public.comment_author('c0000000-0000-0000-0000-000000000001');
    assert card is null, format('FUGA: comment_author revela al autor de un comentario anónimo: %s', card);

    select post_count into cnt from public.public_profile('anav2aaaaa');
    assert cnt = 1, format('FUGA: el perfil cuenta %s publicaciones; lo anónimo no debe contar', cnt);

    select count(*) into n from public.public_user_post_ids('anav2aaaaa', null, 50) u
      where u.id = 'b0000000-0000-0000-0000-000000000001';
    assert n = 0, 'FUGA: la lista pública de Ana incluye su publicación anónima';

    select count(*) into n from public.public_profile('sinnombrex');
    assert n = 0, 'FUGA: alguien sin nombre tiene perfil público';
    raise notice 'ok 23  anonimato: ninguna función pública liga lo anónimo con su autor';
  end $$;
rollback;

-- ── 24. Las funciones internas (reciben ids) no se pueden llamar ─────────────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare f text;
  begin
    foreach f in array array[
      'select public.hides_content(auth.uid(), ''44444444-4444-4444-4444-444444444444'', true)',
      'select public.named_block_between(auth.uid(), ''44444444-4444-4444-4444-444444444444'')',
      'select public.author_card(''44444444-4444-4444-4444-444444444444'', null)',
      'select public.block_named(auth.uid(), ''44444444-4444-4444-4444-444444444444'', ''x'')',
      'select public.notify(auth.uid(), ''new_follower'', null, null, null, null, false, null)'
    ] loop
      begin
        execute f;
        raise exception 'FALLO: authenticated puede ejecutar %', f;
      exception when insufficient_privilege then null;
      end;
    end loop;
    raise notice 'ok 24  funciones internas: no se pueden usar como oráculo';
  end $$;
rollback;

-- ── 25. Bloquear algo anónimo: la fila no dice a quién ───────────────────────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare bid uuid; lbl text; follows_before int; follows_after int;
  begin
    bid := public.block_post_author('b0000000-0000-0000-0000-000000000001');
    select label into lbl from public.blocks where id = bid;
    assert lbl = 'escrito sin firma' and lbl not like '%Ana V2%', format('FUGA: la etiqueta del bloqueo nombra al autor: %s', lbl);
    assert public.post_author('b0000000-0000-0000-0000-000000000002') is not null,
      'bloquear lo anónimo no debe ocultar lo firmado (lo delataría)';
    assert not public.post_hidden_for_me('b0000000-0000-0000-0000-000000000002'),
      'FUGA: lo firmado de la misma persona se ocultó tras bloquear lo anónimo';
    assert public.post_hidden_for_me('b0000000-0000-0000-0000-000000000001'),
      'lo anónimo bloqueado debería ocultarse';
    raise notice 'ok 25  bloqueos: bloquear algo anónimo no revela al autor';
  end $$;
rollback;

-- ── 26. No se autopublica: ni posts ni comentarios, ni con motivo falso ──────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  begin
    begin
      insert into public.post_comments (post_id, author_id, body, status, risk)
        values ('b0000000-0000-0000-0000-000000000002', auth.uid(), 'me salto el filtro', 'published', 'none');
      raise exception 'FALLO: un comentario se autopublicó';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into public.posts (author_id, body, screening_note)
        values (auth.uid(), 'nota falsa', 'filtro: sin hallazgos');
      raise exception 'FALLO: se pudo traer una nota de clasificación falsa';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.posts set status = 'published' where author_id = auth.uid();
      raise exception 'FALLO: el autor puede cambiar el estado de lo suyo';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.post_comments set status = 'published' where author_id = auth.uid();
      raise exception 'FALLO: el autor puede cambiar el estado de un comentario';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 26  posts/comentarios: no se autopublica por ningún lado';
  end $$;
rollback;

-- ── 27. role y public_id no son escribibles; lo nuevo del perfil sí ──────────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  begin
    begin
      update public.profiles set role = 'admin' where id = auth.uid();
      raise exception 'FALLO: Beto se ascendió a admin';
    exception when insufficient_privilege then null;
    end;
    begin
      update public.profiles set public_id = 'robado0000' where id = auth.uid();
      raise exception 'FALLO: se puede cambiar el public_id';
    exception when insufficient_privilege then null;
    end;
    update public.profiles set avatar_emoji = '🌻', avatar_color = 'sky', bio = 'hola' where id = auth.uid();
    begin
      update public.profiles set avatar_color = 'negro' where id = auth.uid();
      raise exception 'FALLO: se aceptó un color fuera de la lista';
    exception when check_violation then null;
    end;
    raise notice 'ok 27  profiles: role y public_id siguen blindados';
  end $$;
rollback;

-- ── 28. Perfiles ajenos siguen sin leerse directo ────────────────────────────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.profiles;
    assert n = 1, format('FUGA: Beto lee %s perfiles; solo debería leer el suyo', n);
    raise notice 'ok 28  profiles: solo la fila propia, aun con perfiles públicos';
  end $$;
rollback;

-- ── 29. Reportes de comentarios: solo los propios, y moderación los ve ───────
begin;
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.comment_reports;
    assert n = 0, format('FUGA: Beto ve %s reportes ajenos (uno es sobre su comentario)', n);
    begin
      insert into public.comment_reports (comment_id, reporter_id, reason, resolved_at)
        values ('c0000000-0000-0000-0000-000000000001', auth.uid(), 'other', now());
      raise exception 'FALLO: se puede insertar un reporte ya resuelto';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 29  comment_reports: nadie ve los reportes de otra persona';
  end $$;
rollback;

-- ── 30. Tres reportes ocultan lo publicado ───────────────────────────────────
begin;
  insert into auth.users (id, email) values
    ('99999999-0000-0000-0000-000000000001', 'r1@upb.edu.co'),
    ('99999999-0000-0000-0000-000000000002', 'r2@upb.edu.co'),
    ('99999999-0000-0000-0000-000000000003', 'r3@upb.edu.co');
  insert into public.post_reports (post_id, reporter_id, reason) values
    ('b0000000-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000001', 'spam'),
    ('b0000000-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000002', 'spam'),
    ('b0000000-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000003', 'spam');
  do $$
  declare st text; hr text;
  begin
    select status, held_reason into st, hr from public.posts where id = 'b0000000-0000-0000-0000-000000000003';
    assert st = 'pending' and hr = 'reports', format('con 3 reportes debió ocultarse: %s / %s', st, hr);
    raise notice 'ok 30  reportes: con 3 se oculta hasta que un administrador decida';
  end $$;
rollback;

\echo ''
\echo '================================'
\echo ' Pruebas RLS v2 pasaron'
\echo '================================'
