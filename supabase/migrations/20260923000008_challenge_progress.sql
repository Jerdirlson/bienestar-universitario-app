-- Raíz · progreso diario de los retos
--
-- Un reto suma a lo sumo un día por día. Guardar la última fecha registrada
-- (el día LOCAL de la persona, que manda el cliente) permite rechazar el
-- segundo registro del mismo día sin llevar una tabla de historial aparte.

alter table public.user_challenges
  add column if not exists last_progress_date date;

comment on column public.user_challenges.last_progress_date is
  'Último día (local de la persona) en que registró progreso. Evita contar dos '
  'veces el mismo día.';
