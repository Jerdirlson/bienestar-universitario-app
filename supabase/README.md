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
tests/
  00_supabase_shim.sql   auth.users y auth.uid() para poder probar sin Supabase
  01_rls_tests.sql       12 pruebas de que las políticas bloquean lo que deben
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
permita a otra persona —moderador o administrador— leer `entries` ajenas. Si
algún día hace falta acceso clínico, tiene que ser un flujo aparte, consentido
explícitamente y registrado en `access_audit`.

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

## Al aplicarlo por primera vez

1. Crear el proyecto de Supabase **a nombre de la UPB**, no personal.
2. Elegir región. Verificar antes si el área legal exige residencia de datos en
   Colombia — puede descartar las regiones por defecto.
3. `supabase link` y `supabase db push`.
4. Confirmar en el panel que las 9 tablas aparecen con RLS activo.
5. Configurar respaldos y **probar una restauración** antes del piloto.
6. Guardar la `service_role` en un gestor de secretos. Esa llave pasa por encima
   de todas las políticas de este esquema: solo la usa el backend de moderación,
   nunca la app.
