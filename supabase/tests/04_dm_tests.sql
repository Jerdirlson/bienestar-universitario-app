-- Pruebas de seguridad de mensajes privados (supabase/migrations/20260927000001_direct_messages.sql).
-- Mismo estilo que los archivos anteriores: cada bloque ATACA la frontera y
-- falla ruidosamente si la base deja pasar algo que no debe. Reutiliza las
-- cuentas sembradas en 02_v2_rls_tests.sql (Ana 4444…, Beto 5555…, admin
-- 6666…, sin-nombre 7777…, mod 8888…) dentro de transacciones que se
-- revierten, así que no hace falta sembrar cuentas nuevas.

\set ON_ERROR_STOP on

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
end $$;

-- ── 36. Sin seguimiento mutuo no se puede escribir ───────────────────────────
-- 02_v2_rls_tests.sql solo hace que Ana siga a Beto (no al revés).
begin;
  update public.profiles set messages_enabled = true
   where id in ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  begin
    begin
      perform public.start_conversation('betov2bbbb');
      raise exception 'FALLO: Ana pudo escribirle a Beto sin seguimiento mutuo';
    exception when insufficient_privilege then
      assert sqlerrm = 'no_se_siguen_mutuamente', format('mensaje inesperado: %s', sqlerrm);
    end;
    raise notice 'ok 36  mensajes: sin seguimiento mutuo no se puede iniciar';
  end $$;
rollback;

-- ── 37. Con los mensajes desactivados, nadie le puede escribir ──────────────
begin;
  insert into public.follows (follower_id, followee_id) values
    ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'),
    ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444')
  on conflict do nothing;
  update public.profiles set messages_enabled = false where id = '55555555-5555-5555-5555-555555555555';
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  begin
    begin
      perform public.start_conversation('betov2bbbb');
      raise exception 'FALLO: se pudo escribir con los mensajes desactivados';
    exception when insufficient_privilege then
      assert sqlerrm = 'mensajes_desactivados', format('mensaje inesperado: %s', sqlerrm);
    end;
    raise notice 'ok 37  mensajes: interruptor apagado bloquea la solicitud';
  end $$;
rollback;

-- ── 38. Anónimo (sin alias) no puede iniciar ni ser destino ──────────────────
begin;
  update public.profiles set messages_enabled = true where id = '77777777-7777-7777-7777-777777777777';
  select pg_temp.as_user('77777777-7777-7777-7777-777777777777');
  set local role authenticated;
  do $$
  begin
    begin
      perform public.start_conversation('anav2aaaaa');
      raise exception 'FALLO: una cuenta sin alias pudo iniciar una conversación';
    exception when insufficient_privilege then
      assert sqlerrm = 'falta_nombre', format('mensaje inesperado: %s', sqlerrm);
    end;
    raise notice 'ok 38a  mensajes: sin alias no se puede iniciar';
  end $$;
rollback;

begin;
  update public.profiles set messages_enabled = true
   where id in ('44444444-4444-4444-4444-444444444444', '77777777-7777-7777-7777-777777777777');
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  begin
    -- sin-nombre no tiene public_id navegable con alias: public_profile ya lo
    -- filtra por display_name is not null, y start_conversation busca igual.
    begin
      perform public.start_conversation('sinnombrex');
      raise exception 'FALLO: se pudo escribir a una cuenta sin alias';
    exception when insufficient_privilege then null; -- no_se_siguen_mutuamente o mensajes_desactivados, cualquiera vale
    when no_data_found then null; -- not_found también es aceptable: nunca "created"
    end;
    raise notice 'ok 38b  mensajes: una cuenta sin alias no es un destino válido';
  end $$;
rollback;

-- ── 39. Bloqueo (en cualquier sentido) impide la conversación ───────────────
begin;
  insert into public.follows (follower_id, followee_id) values
    ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'),
    ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444')
  on conflict do nothing;
  update public.profiles set messages_enabled = true
   where id in ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');
  insert into public.blocks (blocker_id, blocked_id, label) values
    ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 'Ana V2');
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  begin
    begin
      perform public.start_conversation('betov2bbbb');
      raise exception 'FALLO: se pudo escribir a pesar del bloqueo de Beto';
    exception when no_data_found then null;
    end;
    raise notice 'ok 39  mensajes: un bloqueo en cualquier sentido lo impide';
  end $$;
rollback;

-- ── 40. Flujo completo: solicitud, un solo mensaje hasta aceptar, aceptar,
--         conversar, marcar leído, y un tercero no ve nada ──────────────────
begin;
  insert into public.follows (follower_id, followee_id) values
    ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'),
    ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444')
  on conflict do nothing;
  update public.profiles set messages_enabled = true
   where id in ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');

  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  declare
    conv_id uuid;
    msg_id uuid;
    n int;
  begin
    select id into conv_id from public.start_conversation('betov2bbbb');
    assert conv_id is not null, 'debería crear la conversación';

    select public.send_message(conv_id, 'hola Beto, primer mensaje') into msg_id;
    assert msg_id is not null;

    -- Segundo mensaje de quien pidió, antes de aceptar: rechazado.
    begin
      perform public.send_message(conv_id, 'otro más antes de que aceptes');
      raise exception 'FALLO: Ana mandó un segundo mensaje antes de que Beto aceptara';
    exception when insufficient_privilege then
      assert sqlerrm = 'solicitud_pendiente', format('mensaje inesperado: %s', sqlerrm);
    end;

    -- Ana no puede aceptar su propia solicitud.
    begin
      perform public.accept_conversation(conv_id);
      raise exception 'FALLO: quien pide la conversación pudo aceptarla';
    exception when invalid_parameter_value then null;
    end;

    raise notice 'ok 40a  mensajes: la solicitud limita a un mensaje hasta aceptar';
  end $$;

  -- Beto (el destinatario) puede leer la solicitud para decidir, pero no
  -- responder todavía.
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare
    conv_id uuid;
    n int;
  begin
    select c.id into conv_id from public.conversations c
     where (c.user_a = auth.uid() or c.user_b = auth.uid()) and c.status = 'pending';
    assert conv_id is not null, 'Beto debería ver la solicitud pendiente';

    select count(*) into n from public.messages where conversation_id = conv_id;
    assert n = 1, format('Beto debería previsualizar 1 mensaje, ve %s', n);

    begin
      perform public.send_message(conv_id, 'no debería poder responder aún');
      raise exception 'FALLO: Beto respondió sin aceptar';
    exception when insufficient_privilege then
      assert sqlerrm = 'solicitud_pendiente', format('mensaje inesperado: %s', sqlerrm);
    end;

    perform public.accept_conversation(conv_id);
    perform public.send_message(conv_id, 'listo, ya acepté');
    raise notice 'ok 40b  mensajes: el destinatario acepta y entonces sí conversa';
  end $$;

  -- Un tercero (admin, sin ser parte) no ve nada de esta conversación.
  select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.conversations c
     where c.user_a = '44444444-4444-4444-4444-444444444444' or c.user_b = '44444444-4444-4444-4444-444444444444';
    assert n = 0, format('FUGA: un tercero ve %s conversaciones ajenas', n);
    select count(*) into n from public.messages m
      join public.conversations c on c.id = m.conversation_id
     where c.user_a = '44444444-4444-4444-4444-444444444444' or c.user_b = '44444444-4444-4444-4444-444444444444';
    assert n = 0, format('FUGA: un tercero ve %s mensajes ajenos', n);
    raise notice 'ok 40c  mensajes: un tercero no lee nada de la conversación';
  end $$;

  -- Un moderador SIN un caso abierto tampoco ve nada por consulta libre.
  select pg_temp.as_user('88888888-8888-8888-8888-888888888888');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.conversations;
    assert n = 0, format('FUGA GRAVE: un moderador ve %s conversaciones sin caso abierto', n);
    select count(*) into n from public.messages;
    assert n = 0, format('FUGA GRAVE: un moderador ve %s mensajes sin caso abierto', n);
    begin
      perform public.moderation_message_context((select id from public.messages limit 1));
    exception when others then null; -- se espera que falle: no hay ningún reporte
    end;
    raise notice 'ok 40d  mensajes: moderador sin caso abierto no lee nada';
  end $$;

  -- Marcar leído: Beto lee lo de Ana.
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  declare conv_id uuid; n int;
  begin
    select c.id into conv_id from public.conversations c where c.status = 'accepted';
    select count(*) into n from public.messages
     where conversation_id = conv_id and sender_id = auth.uid() and read_at is not null;
    assert n = 0, 'nada debería estar leído todavía';
  end $$;

  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare conv_id uuid; n int;
  begin
    select c.id into conv_id from public.conversations c where c.status = 'accepted';
    perform public.mark_conversation_read(conv_id);
    select count(*) into n from public.messages
     where conversation_id = conv_id and sender_id <> auth.uid() and read_at is null;
    assert n = 0, format('quedaron %s mensajes ajenos sin marcar leídos', n);
    raise notice 'ok 40e  mensajes: marcar leído funciona solo sobre lo ajeno';
  end $$;
rollback;

-- ── 41. Reportar: solo quien participa puede reportar un mensaje ────────────
begin;
  insert into public.follows (follower_id, followee_id) values
    ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'),
    ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444')
  on conflict do nothing;
  update public.profiles set messages_enabled = true
   where id in ('44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555');

  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  declare conv_id uuid; msg_id uuid;
  begin
    select id into conv_id from public.start_conversation('betov2bbbb');
    select public.send_message(conv_id, 'mensaje que luego se reporta') into msg_id;
    perform set_config('raiz.test.msg', msg_id::text, false);
    perform set_config('raiz.test.conv', conv_id::text, false);
  end $$;

  -- Un tercero no puede reportarlo: la política de insert exige participar.
  select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
  set local role authenticated;
  do $$
  declare msg_id uuid := current_setting('raiz.test.msg')::uuid;
          conv_id uuid := current_setting('raiz.test.conv')::uuid;
  begin
    begin
      insert into public.message_reports (message_id, conversation_id, reporter_id, reason)
        values (msg_id, conv_id, auth.uid(), 'harassment');
      raise exception 'FALLO: un tercero pudo reportar un mensaje ajeno';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 41a  mensajes: solo quien participa puede reportar';
  end $$;

  -- Beto (el destinatario, sí participa) reporta.
  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare msg_id uuid := current_setting('raiz.test.msg')::uuid;
          conv_id uuid := current_setting('raiz.test.conv')::uuid;
  begin
    insert into public.message_reports (message_id, conversation_id, reporter_id, reason)
      values (msg_id, conv_id, auth.uid(), 'harassment');
    raise notice 'ok 41b  mensajes: quien participa sí puede reportar';
  end $$;

  -- Ahora el moderador, CON un caso abierto, ve el mensaje y su contexto
  -- acotado — nunca por consulta libre, solo por la función.
  select pg_temp.as_user('88888888-8888-8888-8888-888888888888');
  set local role authenticated;
  do $$
  declare msg_id uuid := current_setting('raiz.test.msg')::uuid;
          n int;
  begin
    select count(*) into n from public.messages;
    assert n = 0, 'un moderador sigue sin poder hacer select libre de messages';

    select count(*) into n from public.moderation_message_context(msg_id);
    assert n >= 1 and n <= 6, format('el contexto debería traer entre 1 y 6 filas, trajo %s', n);

    raise notice 'ok 41c  mensajes: el moderador con caso abierto ve el contexto acotado';
  end $$;

  -- access_audit no lo lee ni un moderador (mismo candado que protege el
  -- diario): se comprueba como dueño, no como authenticated.
  reset role;
  do $$
  declare msg_id uuid := current_setting('raiz.test.msg')::uuid;
          audit_n int;
  begin
    select count(*) into audit_n from public.access_audit
     where target_table = 'messages' and target_id = msg_id::text and action = 'view_reported_conversation';
    assert audit_n >= 1, 'debería quedar registro en la bitácora (access_audit)';
    raise notice 'ok 41d  mensajes: leer el caso queda en la bitácora';
  end $$;
rollback;

-- ── 42. service_role no tiene ningún permiso salvo lo estrictamente dado ────
begin;
  set local role service_role;
  do $$
  begin
    begin
      perform 1 from public.conversations;
      raise exception 'FALLO: service_role pudo leer conversations sin haberlo probado a propósito';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 42  service_role: sin grant de select en conversations, RLS lo sigue negando (bypassrls no suple el grant SQL)';
  end $$;
rollback;
