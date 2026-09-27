-- Pruebas de seguridad de push_tokens (supabase/migrations/20260928000002_push_and_realtime.sql).
-- Mismo estilo que los archivos anteriores: cada bloque ATACA la frontera y
-- falla ruidosamente si la base deja pasar algo que no debe. Reutiliza las
-- cuentas sembradas en 02_v2_rls_tests.sql (Ana 4444…, Beto 5555…, admin
-- 6666…, mod 8888…) dentro de transacciones que se revierten.

\set ON_ERROR_STOP on

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', u)::text, true);
end $$;

-- ── 43. Cada quien registra su propio token, y solo el suyo ─────────────────
begin;
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  begin
    insert into public.push_tokens (user_id, token) values (auth.uid(), 'ExponentPushToken[ana-1]');
    -- Intentar registrar un token a nombre de otra persona: la política lo
    -- niega (el check compara con auth.uid(), no con lo que se mande).
    begin
      insert into public.push_tokens (user_id, token)
        values ('55555555-5555-5555-5555-555555555555', 'ExponentPushToken[suplantado]');
      raise exception 'FALLO: Ana pudo registrar un token a nombre de Beto';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 43  push_tokens: solo se registra el propio token';
  end $$;
rollback;

-- ── 44. Nadie lee los tokens de otra persona ────────────────────────────────
begin;
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$ begin
    insert into public.push_tokens (user_id, token) values (auth.uid(), 'ExponentPushToken[ana-2]');
  end $$;

  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.push_tokens where user_id = '44444444-4444-4444-4444-444444444444';
    assert n = 0, format('FUGA: Beto ve %s tokens de Ana', n);
    select count(*) into n from public.push_tokens;
    assert n = 0, format('FUGA: la consulta libre de Beto trae %s filas ajenas', n);
    raise notice 'ok 44  push_tokens: nadie lee el token de otra persona';
  end $$;
rollback;

-- ── 45. Cada quien borra (deslogueo) solo su propio token ───────────────────
begin;
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$ begin
    insert into public.push_tokens (user_id, token) values (auth.uid(), 'ExponentPushToken[ana-3]');
  end $$;

  select pg_temp.as_user('55555555-5555-5555-5555-555555555555');
  set local role authenticated;
  do $$
  declare n int;
  begin
    delete from public.push_tokens where user_id = '44444444-4444-4444-4444-444444444444';
    get diagnostics n = row_count;
    assert n = 0, format('FALLO: Beto pudo borrar %s tokens de Ana', n);
    raise notice 'ok 45  push_tokens: nadie borra el token de otra persona';
  end $$;

  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$
  declare n int;
  begin
    delete from public.push_tokens where user_id = auth.uid();
    get diagnostics n = row_count;
    assert n = 1, format('el propio borrado debería afectar 1 fila, afectó %s', n);
    raise notice 'ok 45b  push_tokens: el dueño sí borra el propio';
  end $$;
rollback;

-- ── 46. Un admin/moderador tampoco tiene acceso libre por su rol ────────────
begin;
  select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
  set local role authenticated;
  do $$ begin
    insert into public.push_tokens (user_id, token) values (auth.uid(), 'ExponentPushToken[ana-4]');
  end $$;

  select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
  set local role authenticated;
  do $$
  declare n int;
  begin
    select count(*) into n from public.push_tokens;
    assert n = 0, format('FUGA GRAVE: un admin ve %s tokens ajenos', n);
    raise notice 'ok 46  push_tokens: is_admin() no da acceso a los tokens de nadie';
  end $$;
rollback;

-- ── 47. service_role: sin grant explícito de update, no puede tocar el interruptor ──
begin;
  set local role service_role;
  do $$
  begin
    begin
      update public.profiles set push_enabled = false where id = '44444444-4444-4444-4444-444444444444';
      raise exception 'FALLO: service_role pudo apagar el interruptor de otra persona sin grant';
    exception when insufficient_privilege then null;
    end;
    raise notice 'ok 47  service_role: sin grant de update en push_enabled, RLS/grant lo sigue negando';
  end $$;
rollback;
