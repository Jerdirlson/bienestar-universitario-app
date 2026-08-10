-- Catálogo inicial de retos.
--
-- Vive en la base y no en el código para que Bienestar pueda agregar, retirar o
-- reformular retos sin publicar una versión nueva de la app. `key` es estable:
-- el progreso de las personas se referencia contra ella, así que renombrar un
-- título es seguro, cambiar una clave no.

insert into public.challenges (key, title_es, title_en, total_days) values
  ('breathing_7',   '7 días de respiración', '7 days of breathing',  7),
  ('gratitude_7',   '7 días de gratitud',    '7 days of gratitude',  7),
  ('sleep_14',      'Dormir antes de 11pm',  'Sleep before 11pm',   14),
  ('walk_30',       'Caminar 20 minutos',    'Walk 20 minutes',     30)
on conflict (key) do nothing;
