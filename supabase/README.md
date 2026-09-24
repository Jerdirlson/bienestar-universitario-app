# Base de datos de Raíz

Esquema de Postgres para Supabase. Todavía **no está aplicado a ningún proyecto real** —
falta crear el proyecto de Supabase a nombre de la UPB. Estas migraciones ya están
probadas contra un Postgres 16 limpio y se pueden aplicar tal cual cuando exista.

## Estructura

```
migrations/
  20260809000001_initial_schema.sql    tablas, tipos, índices, triggers
  20260809000002_row_level_security.sql políticas de acceso  ← lo importante
  20260809000003_seed_challenges.sql    catálogo inicial de retos
  2026081…                              login, moderación, comentarios, Explorar
  20260923000001_public_profiles.sql    public_id, avatar y bio (perfil público)
  20260923000002_journal_entries.sql    diario libre — tan privado como entries
  20260923000003_community_v2.sql       temas, edición, motivo de retención, tipos de reacción, respuestas
  20260923000004_comment_likes_and_reports.sql
  20260923000005_saved_follows_blocks.sql
  20260923000006_notifications.sql      tabla y triggers que las crean
  20260923000007_report_threshold.sql   3 reportes → se oculta
  20260923000008_challenge_progress.sql un día por día en los retos
  20260923000009_public_functions.sql   lo público de otras personas, sin abrir profiles
tests/
  00_supabase_shim.sql   auth.users y auth.uid() para poder probar sin Supabase
  01_rls_tests.sql       12 pruebas de que las políticas bloquean lo que deben
  02_v2_rls_tests.sql    18 más: diario libre, comunidad v2, anonimato
run-tests.sh             levanta Postgres en Docker, aplica todo y corre las pruebas
```

## Correr las pruebas

```bash
npm run db:test     # requiere Docker
```

Levanta un contenedor efímero, aplica las migraciones en orden y verifica el
comportamiento de seguridad. No toca ninguna base real y borra el contenedor al
terminar.

## Las dos reglas que sostienen el diseño

**1. Seudonimización.** Ninguna tabla de contenido guarda nombre ni correo
institucional. Todo referencia `profiles.id`, que es el identificador opaco del
proveedor de identidad. Quien obtenga una copia de `entries` no puede saber de
quién es sin cruzar contra `auth.users`.

**2. El diario es privado sin excepciones.** No existe ninguna política que
permita a otra persona —moderador o administrador— leer `entries` ni
`journal_entries` ajenas, y `service_role` no tiene ningún grant sobre ellas. Si
algún día hace falta acceso clínico, tiene que ser un flujo aparte, consentido
explícitamente y registrado en `access_audit`.

**3. Anonimato real.** `profiles` sigue dejando leer solo la fila propia. Lo
público de otras personas (alias, avatar, bio, conteos) sale de funciones
`security definer` que reciben un `public_id` o el id de una publicación, nunca
el id interno de nadie, y que devuelven null para lo anónimo. Las que sí
reciben ids internos (`hides_content`, `notify`, `author_card`, …) no se
conceden a ningún rol del cliente. `blocks.blocked_id` y
`notifications.actor_id` no son legibles desde el cliente (grant por columnas).

Bloquear al autor de algo anónimo oculta solo lo anónimo de esa persona y no
toca los seguimientos: si ocultara también lo que firma con su nombre, bastaría
con ver qué nombre desaparece para saber quién escribió lo anónimo. Por la
misma razón, bloquear un perfil con nombre oculta solo lo firmado.

**4. Nada se publica solo.** Publicaciones y comentarios siguen naciendo
`pending`; el API (como `service_role`) los pasa por `api/src/moderation.js` y
publica lo que no tiene riesgo. Quien escribe no puede traer puesto un estado,
un motivo de retención ni una nota de clasificación.

## Qué verifican las pruebas

| # | Qué |
|---|---|
| 1 | El perfil se crea solo al registrarse la cuenta |
| 2 | Cada persona ve únicamente su propio diario |
| 3 | No se puede escribir un diario a nombre de otro |
| 4 | Un moderador tampoco ve diarios ajenos |
| 5 | Nadie puede ascenderse a moderador editando su perfil |
| 6 | No se puede autopublicar saltándose la moderación |
| 7 | Publicar entra correctamente en la cola |
| 8 | Lo pendiente no se filtra al feed público |
| 9 | El moderador sí ve la cola completa |
| 10 | No se puede reaccionar a algo aún no publicado |
| 11 | `access_audit` es invisible desde el cliente |
| 12 | Un solo check-in por persona por día |
| 13–17 | Diario libre: solo lo propio; ni moderador, ni administrador, ni `service_role` lo leen; no se pisa con un upsert |
| 18–21 | Guardados, seguimientos, bloqueos y notificaciones: nadie ve ni toca los de otra persona |
| 20 | `blocked_id` no es legible y no hay insert directo de bloqueos ni seguimientos |
| 22–25 | Anonimato: ninguna función pública liga lo anónimo con su autor; las internas no se pueden llamar |
| 26 | No se autopublica: ni comentarios, ni con nota falsa, ni cambiando el estado |
| 27–28 | `role` y `public_id` no son escribibles; `profiles` ajenos siguen sin leerse |
| 29–30 | Reportes de comentarios privados; 3 reportes ocultan lo publicado |

## Al aplicarlo por primera vez

1. Crear el proyecto de Supabase **a nombre de la UPB**, no personal.
2. Elegir región. Verificar antes si el área legal exige residencia de datos en
   Colombia — puede descartar las regiones por defecto.
3. `supabase link` y `supabase db push`.
4. Confirmar en el panel que las 19 tablas aparecen con RLS activo.
5. Configurar respaldos y **probar una restauración** antes del piloto.
6. Guardar la `service_role` en un gestor de secretos. Esa llave pasa por encima
   de todas las políticas de este esquema: solo la usa el backend de moderación,
   nunca la app.
