-- Raíz · umbral de reportes
--
-- Con 3 reportes abiertos de personas distintas, una publicación o un
-- comentario publicado se oculta solo: vuelve a 'pending' con
-- held_reason = 'reports' hasta que un administrador decida (publicar de
-- nuevo, rechazar o quitar). No hace falta esperar a que alguien del equipo
-- esté conectado para que algo dañino deje de verse.
--
-- Tres y no uno: un solo reporte no debe bastar para que una persona
-- silencie a otra. unique (post_id, reporter_id) ya impide que alguien
-- reporte dos veces lo mismo.
--
-- security definer porque quien reporta no puede (ni debe poder) cambiar el
-- estado de una publicación ajena. El trigger lo hace en su nombre, y solo
-- esto.

create or replace function public.on_post_report_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_reports int;
  hidden record;
begin
  select count(distinct reporter_id) into open_reports
    from public.post_reports
   where post_id = new.post_id and resolved_at is null;

  if open_reports >= 3 then
    update public.posts
       set status = 'pending', held_reason = 'reports'
     where id = new.post_id and status = 'published'
     returning author_id, body into hidden;

    if found then
      perform public.notify(hidden.author_id, 'post_hidden', new.post_id, null, null,
                            null, true, hidden.body);
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.on_post_report_threshold() from public, anon, authenticated;

drop trigger if exists post_reports_threshold on public.post_reports;
create trigger post_reports_threshold
  after insert on public.post_reports
  for each row execute function public.on_post_report_threshold();

-- Comentarios: mismo umbral. El contrato no define una notificación de
-- "comentario ocultado", así que solo se oculta.
create or replace function public.on_comment_report_threshold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  open_reports int;
begin
  select count(distinct reporter_id) into open_reports
    from public.comment_reports
   where comment_id = new.comment_id and resolved_at is null;

  if open_reports >= 3 then
    update public.post_comments
       set status = 'pending', held_reason = 'reports'
     where id = new.comment_id and status = 'published';
  end if;
  return new;
end;
$$;

revoke all on function public.on_comment_report_threshold() from public, anon, authenticated;

drop trigger if exists comment_reports_threshold on public.comment_reports;
create trigger comment_reports_threshold
  after insert on public.comment_reports
  for each row execute function public.on_comment_report_threshold();
