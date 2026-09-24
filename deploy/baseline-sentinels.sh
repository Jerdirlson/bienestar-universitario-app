#!/usr/bin/env bash
# Centinelas de --baseline (lo usa apply-migrations.sh con `source`).
#
# --baseline marca migraciones como "ya aplicadas" SIN correrlas. Si la base
# no tenía de verdad alguna (se creó a medias, o con otra versión del
# esquema), marcarla sin comprobar dejaría la base sin esa tabla o ese
# permiso para siempre: el registro diría que está y nadie la volvería a
# aplicar. Por eso cada migración tiene aquí un objeto centinela —algo que
# esa migración crea y que existe si y solo si se aplicó— y apply-migrations
# se niega a marcar nada si falta alguno.
#
# Cada expresión es SQL que devuelve un booleano y NO falla si el objeto no
# existe (to_regclass, pg_catalog…): sobre una base vacía da false, no error.
# Probado en api/tests/baseline.test.mjs contra una base completa y una vacía.
#
# Migración nueva → agregar su centinela aquí. Sin centinela, --baseline se
# niega a marcarla (lo seguro).

# Tabla y privilegio sin fallar si la tabla o el rol no existen.
_priv() { # rol tabla privilegio
  echo "(exists (select 1 from pg_roles where rolname = '$1') and to_regclass('$2') is not null and has_table_privilege('$1', '$2', '$3'))"
}
_col() { # esquema tabla columna
  echo "exists (select 1 from information_schema.columns where table_schema = '$1' and table_name = '$2' and column_name = '$3')"
}
_fn() { # firma regprocedure
  echo "(to_regprocedure('$1') is not null)"
}

sentinel_for() {
  case "$1" in
    00000000000000_auth_compat.sql)
      echo "(to_regclass('auth.users') is not null and $(_fn 'auth.uid()'))" ;;
    20260809000001_initial_schema.sql)
      echo "(to_regclass('public.profiles') is not null and to_regclass('public.posts') is not null and to_regclass('public.entries') is not null)" ;;
    20260809000002_row_level_security.sql)
      echo "exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'entries')" ;;
    20260809000003_seed_challenges.sql)
      # Datos, no esquema: la fila sembrada. query_to_xml consulta la tabla
      # solo si existe (una referencia directa fallaría al planear).
      echo "(case when to_regclass('public.challenges') is null then false else (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.challenges where key = ''breathing_7''', false, true, '')))[1]::text::int > 0 end)" ;;
    20260813000001_access_codes.sql)
      echo "(to_regclass('auth.access_codes') is not null)" ;;
    20260814000001_password_auth.sql)
      echo "$(_col auth users password_hash)" ;;
    20260814000002_moderation_grants.sql)
      echo "$(_priv service_role public.moderation_actions INSERT)" ;;
    20260814000003_moderation_actions_fk_fix.sql)
      echo "exists (select 1 from pg_constraint where conname = 'moderation_actions_moderator_id_fkey' and confdeltype = 'r')" ;;
    20260814000004_post_anonymity.sql)
      echo "$(_col public posts is_anonymous)" ;;
    20260814000005_post_comments.sql)
      echo "(to_regclass('public.post_comments') is not null)" ;;
    20260814000006_explore_and_admin.sql)
      echo "(to_regclass('public.explore_resources') is not null)" ;;
    20260814000007_admin_user_grants.sql)
      echo "$(_priv service_role auth.users DELETE)" ;;
    20260923000001_public_profiles.sql)
      echo "$(_col public profiles public_id)" ;;
    20260923000002_journal_entries.sql)
      echo "(to_regclass('public.journal_entries') is not null)" ;;
    20260923000003_community_v2.sql)
      echo "$(_col public posts topic)" ;;
    20260923000004_comment_likes_and_reports.sql)
      echo "(to_regclass('public.comment_likes') is not null and to_regclass('public.comment_reports') is not null)" ;;
    20260923000005_saved_follows_blocks.sql)
      echo "(to_regclass('public.blocks') is not null)" ;;
    20260923000006_notifications.sql)
      echo "(to_regclass('public.notifications') is not null)" ;;
    20260923000007_report_threshold.sql)
      echo "$(_fn 'public.on_post_report_threshold()')" ;;
    20260923000008_challenge_progress.sql)
      echo "$(_col public user_challenges last_progress_date)" ;;
    20260923000009_public_functions.sql)
      echo "$(_fn 'public.block_user(text)')" ;;
    20260923000010_security_review.sql)
      echo "(to_regclass('public.publication_events') is not null and $(_fn 'public.hides_source(uuid,text)'))" ;;
    *)
      return 1 ;;
  esac
}
