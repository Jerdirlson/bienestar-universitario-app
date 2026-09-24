# API de Raíz — contrato v2

Contrato entre `api/` y la app (`src/data/*`). Si una ruta cambia, cambia aquí
primero. Todo en JSON, campos en snake_case en las respuestas; los cuerpos de
petición aceptan camelCase como hasta ahora. Errores: `{ "error": "<codigo>" }`
con el status HTTP que corresponda. Toda ruta salvo `/health`, `/meta` y
`/auth/request-code|verify-code|login-password` exige `Authorization: Bearer`.

Reglas que no se negocian (ver CLAUDE.md):
- **El diario es privado.** `entries` y `journal_entries` solo los lee y
  escribe su dueño; ninguna ruta, ni de administración, los expone. Nunca pasan
  por el filtro de moderación: el servidor no analiza el contenido del diario.
- **Anonimato real.** Una publicación o comentario anónimo no devuelve nada que
  permita ligarlo a su autor: ni `public_id`, ni alias, ni avatar. Bloquear al
  autor de algo anónimo no revela quién es.
- **Nada se publica sin pasar el filtro** (`api/src/moderation.js`). Lo que no
  tiene riesgo se publica en el acto; lo riesgoso queda en revisión humana.

## Descubrimiento

`GET /meta` (sin sesión) → `{ "api_version": 2 }`.
La app lo usa para saber si el servidor ya tiene v2; un 404 significa v1 y la
app oculta lo que v1 no tiene en vez de fallar.

## Cuenta y perfil

`GET /auth/me` → `{ id, email, display_name, role, locale, created_at,
public_id, avatar_emoji, avatar_color, bio }`

`PATCH /auth/profile` — parcial, cualquier subconjunto de:
`{ displayName, avatarEmoji, avatarColor, bio, locale }`
- displayName 2–40 · avatarEmoji 1–8 chars · bio 0–160 · locale 'es'|'en'
- avatarColor ∈ `lilac, mint, sun, peach, sky, rose`
- Errores: `nombre_invalido`, `avatar_invalido`, `bio_invalida`, `locale_invalido`

`DELETE /auth/account` → borra la cuenta y **todo** lo suyo (cascada).
`{ ok: true }`. Un admin con historial de moderación recibe 409
`tiene_historial_de_moderacion`.

## Diario (privado)

Check-in diario, uno por día:

`GET /entries` → `{ entries: [Entry] }` — todas las del usuario, más reciente primero.
`Entry = { entry_date: 'AAAA-MM-DD', mood: 0..4, feelings: [clave], causes: [clave], note, created_at, updated_at }`

`PUT /entries/:date` `{ mood, feelings, causes, note }` → `{ entry }`
Upsert por (usuario, fecha). Mismas validaciones que `src/data/entry.js`
(`mood` entero 0–4, arreglos de claves de texto, `note` ≤ 4000). Error
`entrada_invalida`.

`DELETE /entries/:date` → `{ ok: true }` (idempotente).

Diario libre, varias entradas por día:

`GET /journal` → `{ entries: [Journal] }` más reciente primero.
`Journal = { id: uuid, title, body, prompt_key, mood, created_at, updated_at }`

`PUT /journal/:id` `{ title?, body, promptKey?, mood?, createdAt? }` → `{ entry }`
El `id` lo genera el cliente (uuid v4) para poder crear sin conexión. Upsert.
title ≤ 120 · body 1–10000 · promptKey ≤ 40 · mood 0–4 o null. Error `entrada_invalida`.

`DELETE /journal/:id` → `{ ok: true }` (idempotente).

## Comunidad

### Objeto Post
```
{
  id, body, mood, topic, status, created_at, edited_at,
  author: null | { public_id, display_name, avatar_emoji, avatar_color },
  author_name,              // = author?.display_name ?? null (compatibilidad v1)
  is_own,
  reactions,                // total (compatibilidad v1)
  reaction_counts: { abrazo, fuerza, te_entiendo, inspira },
  my_reaction: null | 'abrazo' | 'fuerza' | 'te_entiendo' | 'inspira',
  reacted_by_me,            // = my_reaction !== null (compatibilidad v1)
  comment_count,            // solo comentarios publicados
  saved_by_me,
  held_reason: null | 'crisis' | 'review' | 'reports'   // solo si is_own y status='pending'
}
```
`author` es null si la publicación es anónima. Temas (`topic`):
`general, estudios, ansiedad, relaciones, logros, autocuidado, desahogo`.

### Feed
`GET /posts?feed=all|following&topic=&sort=recent|popular&q=&before=&limit=`
→ `{ posts: [Post], next_before: iso | null }`
- `feed=following`: publicaciones con nombre de las personas que sigo.
- `sort=popular`: últimos 7 días por reacciones + comentarios.
- `q`: búsqueda de texto en el cuerpo (insensible a mayúsculas y tildes).
- `before`: paginación por `created_at` (ignorado con `sort=popular`, que usa `offset`).
- `limit` 1–50, por defecto 20.
- Nunca incluye publicaciones de autores que bloqueé. Incluye las mías en cualquier estado.

`GET /posts/:id` → `{ post }` · 404 `not_found` si no existe o no la puedo ver.

`POST /posts` `{ body, mood?, topic?, isAnonymous? }`
→ 201 `{ post, moderation: { outcome: 'published' | 'held', reason: null | 'crisis' | 'review' } }`
Con `reason: 'crisis'` la app muestra los recursos del SOS. Errores:
`texto_invalido`, `mood_invalido`, `tema_invalido`, `falta_nombre`,
429 `demasiadas_publicaciones` (más de 10 por hora; se cuentan las
publicaciones hechas, aunque después se hayan borrado).

`PATCH /posts/:id` `{ body, mood?, topic? }` — solo lo propio. Se vuelve a
filtrar; misma respuesta que POST (200). Marca `edited_at`. Lo retenido por
**crisis** no se edita (409 `no_editable`: editar borraría la alerta antes de
que alguien del equipo la vea). Lo retenido para **revisión** se puede
corregir, pero sigue `pending` con `held_reason: 'review'` y el riesgo más
alto entre el anterior y el nuevo — nunca se autopublica; si el texto nuevo
es crisis, pasa a crisis.

`DELETE /posts/:id` → `{ ok: true }` — solo lo propio, aunque se tenga rol de
moderación (quitar contenido ajeno es del panel, que lo audita). Sobre algo
ajeno no hace nada.

### Reacciones, guardados, reportes
`POST /posts/:id/react` `{ kind? }` (por defecto `abrazo`) — una reacción por
persona; volver a reaccionar cambia el tipo. `DELETE /posts/:id/react`.
Errores: `reaccion_invalida`.

`POST /posts/:id/save` / `DELETE /posts/:id/save` → `{ ok: true }`

`POST /posts/:id/report` `{ reason, detail? }` — reason ∈
`self_harm, harassment, spam, personal_info, other`. Con 3 reportes distintos
la publicación se oculta (vuelve a `pending`, `held_reason: 'reports'`) hasta
que un administrador decida.

### Comentarios
Objeto Comment:
```
{ id, post_id, parent_id, body, status, created_at,
  author: null | { public_id, display_name, avatar_emoji, avatar_color },
  author_name, is_own, likes, liked_by_me,
  held_reason: null | 'crisis' | 'review' | 'reports' }
```
`GET /posts/:id/comments` → `{ comments: [Comment] }` en orden cronológico.
Respuestas de un solo nivel: `parent_id` apunta a un comentario de primer nivel.

`POST /posts/:id/comments` `{ body, isAnonymous?, parentId? }`
→ 201 `{ comment, moderation }`. 429 `demasiados_comentarios` (más de 30 por
hora, contando también los borrados).
`DELETE /posts/comments/:id` — solo lo propio, como `DELETE /posts/:id`.
`POST|DELETE /posts/comments/:id/like`
`POST /posts/comments/:id/report` `{ reason, detail? }` (mismo umbral de 3)

### Personas
Solo tienen perfil público quienes eligieron un nombre. Nada de lo anónimo
aparece aquí.

`GET /users/:publicId` → `{ user: { public_id, display_name, avatar_emoji,
avatar_color, bio, member_since, post_count, followers, following,
followed_by_me, is_me } }`

`GET /users/:publicId/posts?before=` → `{ posts, next_before }` — solo las
publicadas con nombre.

`POST|DELETE /users/:publicId/follow` — seguirse a sí mismo: 400 `accion_invalida`.

### Bloqueos
`POST /posts/:id/block-author` — funciona también con anónimos, sin revelar al autor.
`POST /posts/comments/:id/block-author` — igual, desde un comentario.
`POST /users/:publicId/block`
`GET /me/blocks` → `{ blocks: [{ id, created_at, label }] }` — `label` es el
alias si se bloqueó desde un perfil con nombre, o un extracto de lo que motivó
el bloqueo si era anónimo. Nunca el alias de un autor anónimo.
`DELETE /me/blocks/:id`

Bloquear desde un perfil o algo con nombre oculta en ambos sentidos lo que
cada uno firma con su nombre, y deshace el seguimiento entre ambas personas.
Bloquear desde algo **anónimo** oculta **solo ese contenido** (y deja de
notificar las reacciones y "me gusta" de esa persona a quien bloquea); ver
"Bloqueos y anonimato" en las aclaraciones.

### Lo mío
`GET /me/posts?before=` → mis publicaciones en cualquier estado, con `held_reason`.
`GET /me/saved?before=` → publicaciones guardadas que todavía puedo ver.

### Notificaciones
`GET /notifications?before=` → `{ notifications: [N], unread, next_before }`
```
N = { id, kind, post_id, comment_id, reaction_kind, actor: null | { public_id,
      display_name, avatar_emoji, avatar_color }, excerpt, created_at, read }
```
`kind` ∈ `post_reaction, post_comment, comment_reply, comment_like,
new_follower, post_approved, post_rejected, post_hidden, comment_approved,
comment_rejected`. `actor` es null si quien actuó lo hizo de forma anónima, y
**siempre** en `post_reaction` y `comment_like`: reaccionar o dar "me gusta"
no revela el alias (seguir sí: `new_follower` trae actor). Nunca se notifica a
una persona de su propia acción ni de alguien que bloqueó. Si el contenido se
rechaza, se quita o se oculta por reportes, sus notificaciones
(`post_comment`, `comment_reply`, `comment_like`, `post_reaction`) se borran:
no queda nada de lo retirado en los avisos de nadie.

`GET /notifications/unread-count` → `{ unread }`
`POST /notifications/read` `{ ids? }` — sin `ids` marca todas.

## Retos

`GET /challenges` → `{ challenges: [{ key, title, total_days, joined,
completed_days, completed_at, checked_today }] }` (`title` según `?lang=es|en`)
`POST /challenges/:key/join` · `DELETE /challenges/:key` (abandonar)
`POST /challenges/:key/progress` — una vez por día; suma un día y marca
`completed_at` al llegar a `total_days`. Dos veces el mismo día: 409 `ya_registrado_hoy`.
Acepta `{ date: 'AAAA-MM-DD' }` para el día local del cliente.

## Administración (panel web, exige `is_admin()`)

Lo existente, más:
- `GET /admin/queue` incluye `risk`, `screening_note`, `held_reason` y conteo de reportes.
- `GET /admin/reports` → reportes abiertos de publicaciones y comentarios.
- `POST /admin/reports/:id/dismiss` · `POST /admin/posts/:id/moderate { action: 'publish'|'reject'|'remove' }`
- Aprobar o rechazar notifica al autor (`post_approved`, `post_rejected`, …).
- `GET /admin/stats` → conteos generales (usuarios, publicaciones por estado,
  reportes abiertos). **Nunca** conteos ni datos del diario por persona.

## Aclaraciones de la implementación

Todo lo de arriba se cumple tal cual. Esto aclara lo que el contrato no
fijaba; son campos **adicionales** o códigos de error, nunca cambios de forma.

- `sort=popular`: además de `next_before: null`, responde `next_offset`
  (número o null) para pedir la página siguiente con `&offset=`.
- `PATCH /auth/profile` → `{ ok: true, profile }` (`profile` = forma de `/auth/me`).
  Sin ningún campo reconocido: 400 `nombre_invalido` (como en v1).
- `POST /posts/:id/block-author`, `POST /posts/comments/:id/block-author`,
  `POST /users/:publicId/block` → `{ ok: true, block: { id, created_at, label } }`.
- `POST /challenges/:key/join|progress` → `{ ok: true, challenge }` (forma de
  `GET /challenges`). `progress` une al reto si no estaba unido; con un reto ya
  completo no suma más. `date` debe estar a ±1 día del día en Bogotá: si no,
  400 `fecha_invalida`. `GET /challenges?date=` acepta cualquier fecha real.
- `POST /notifications/read` → `{ ok: true, unread }`.
- `POST /admin/reports/:id/dismiss` → `{ ok: true, restored }`: si con eso el
  contenido queda sin reportes abiertos y estaba oculto solo por reportes,
  vuelve a publicarse. `POST /admin/comments/:id/moderate` también acepta
  `remove`. Moderar algo que ya no está en un estado moderable: 409 `estado_invalido`.
- `GET /admin/stats` → `{ users, users_with_name, posts: {pending, published,
  rejected, removed}, comments: {…}, open_reports, crisis_pending, posts_last_7_days }`.
- `member_since` es un timestamp ISO (la fecha de alta del perfil).
- Errores adicionales: `PATCH /posts/:id` sobre algo rechazado, quitado u
  oculto por reportes o retenido por crisis → 409 `no_editable` (editarlo lo haría pasar el filtro y
  saltarse la decisión). `parentId` inválido o que no es de primer nivel → 400
  `respuesta_invalida`. Reaccionar, guardar, comentar o dar "me gusta" sobre algo
  que no se puede ver → 404 `not_found` (en v1 era 500). `/journal/:id` con un id
  que no es uuid → 400 `entrada_invalida`; con el id de una entrada de otra
  persona → 404.
- Bloqueos y anonimato: bloquear desde algo **anónimo** oculta **solo ese
  contenido** (la publicación o el comentario desde el que se bloqueó), no
  deshace seguimientos y no oculta nada en sentido contrario; bloquear desde un
  perfil o algo con nombre oculta lo firmado (en ambos sentidos) y deshace
  seguimientos. Cada restricción cierra un oráculo: si un bloqueo anónimo
  ocultara lo firmado, bastaría ver qué nombre desaparece para saber quién
  escribió lo anónimo; si ocultara todo lo anónimo de su autor, bastaría ver
  qué otras publicaciones anónimas dan 404 para saber cuáles son de la misma
  persona; y si ocultara algo en sentido contrario, el autor sabría quién lo
  bloqueó. Un bloqueo anónimo sí silencia las notificaciones de reacciones y
  "me gusta" de esa persona (no dicen de quién son). Los comentarios anónimos
  suyos siguen notificando ("alguien comentó"): un comentario visible sin su
  aviso diría que es de la misma persona.
