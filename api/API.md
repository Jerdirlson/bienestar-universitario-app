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
  held_reason: null | 'crisis' | 'review' | 'reports' | 'appeal'   // solo si is_own y status='pending'
  appealed                  // true si ya se usó la única apelación (solo tiene sentido con is_own)
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

`POST /posts/:id/appeal` (también `POST /posts/comments/:id/appeal`) — pedir
UNA revisión más de algo rechazado (`status='rejected'`), solo lo propio.
Vuelve a la cola: `status='pending'`, `held_reason='appeal'`. → `{ post }` (o
`{ comment }`). Una segunda apelación, o apelar algo que no está rechazado o
no es propio: 409 `no_apelable`. Es para siempre: aunque se vuelva a
rechazar, no se puede apelar otra vez.

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
followed_by_me, is_me, can_message } }`
`can_message`: true solo si esa persona activó los mensajes, se siguen
mutuamente y no hay bloqueo — la app muestra "Enviar mensaje" solo entonces.

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
N = { id, kind, post_id, comment_id, conversation_id, reaction_kind,
      actor: null | { public_id, display_name, avatar_emoji, avatar_color },
      excerpt, created_at, read }
```
`kind` ∈ `post_reaction, post_comment, comment_reply, comment_like,
new_follower, post_approved, post_rejected, post_hidden, comment_approved,
comment_rejected, support_sent, message_request, new_message,
moderation_alert`. `actor` es null si quien actuó lo hizo de forma anónima, y
**siempre** en `post_reaction`, `comment_like`, `support_sent` y
`moderation_alert` (reaccionar, dar "me gusta", el protocolo de crisis y la
alerta a moderadores no revelan quién fue; seguir y mensajear sí:
`new_follower`, `message_request` y `new_message` traen actor — los mensajes
privados nunca son anónimos). `support_sent`, `moderation_alert`,
`message_request` y `new_message` tampoco traen `excerpt` — ninguno repite
una palabra de lo escrito, solo el aviso (lo arma la app con `kind`;
`message_request`/`new_message` traen `conversation_id` para abrir el chat
correcto). `moderation_alert` tampoco trae `post_id` ni `comment_id`: no
delata qué quedó retenido; tocarla abre el panel de moderación
(`GET /panel`) en el navegador. Es solo para moderadores/administradores
(`api/src/alerts.js`, protocolo de crisis): al retener algo por crisis, y en
el resumen horario de crisis sin atender por más de 30 minutos, se crea una
para cada `moderator`/`admin` — pero no si ya tiene una `moderation_alert`
sin leer, para no llenar la campanita.
Nunca se notifica a una persona de su propia acción ni de alguien que
bloqueó. Si el contenido se rechaza, se quita o se oculta por reportes, sus
notificaciones (`post_comment`, `comment_reply`, `comment_like`,
`post_reaction`) se borran: no queda nada de lo retirado en los avisos de
nadie.

`GET /notifications/unread-count` → `{ unread }`
`POST /notifications/read` `{ ids? }` — sin `ids` marca todas.

## Mensajes privados

Desactivado por defecto. Solo entre perfiles **con alias** que se **siguen
mutuamente**, con los mensajes activados por el destino, y sin bloqueo en
ningún sentido (ver `docs/auditoria/competencia.md` §4 y CLAUDE.md). El
primer mensaje ES la solicitud: la conversación nace `pending` y quien la
pide no puede mandar un segundo mensaje hasta que se acepte. Cada mensaje
pasa por el mismo filtro que la comunidad (`api/src/moderation.js`) **antes**
de entregarse: crisis SÍ se entrega (el remitente ve el SOS); acoso/amenaza o
datos personales NO se entrega, el remitente ve por qué. Solo texto, ≤1000
caracteres, sin adjuntos. Retención: 90 días, salvo lo que esté en un caso de
reporte abierto (tarea periódica, `api/src/messages.js`).

`GET /messages/settings` → `{ enabled }`
`PUT /messages/settings` `{ enabled }` → `{ ok, enabled }`

`GET /messages/unread-count` → `{ unread, requests }` — mensajes sin leer en
conversaciones aceptadas, y solicitudes recibidas sin decidir.

### Objeto Conversation
```
{ id, status: 'pending'|'accepted'|'rejected', created_at, accepted_at,
  last_message_at, requested_by_me,
  other: { public_id, display_name, avatar_emoji, avatar_color } }
```
En las listas trae además `unread_count` y `last_message: { body, removed,
is_own, created_at } | null`.

`GET /messages/conversations?before=` → `{ conversations: [Conversation],
next_before }` — solo `status='accepted'`, más reciente primero.

`GET /messages/requests` → `{ requests: [{ id, created_at, other, body }] }`
— solicitudes pendientes donde la otra persona la envió; `body` es su único
mensaje, para decidir sin comprometerse a abrir el chat.

`GET /messages/conversations/:id` → `{ conversation }` (abrir). 404
`not_found` si no existe o no se participa en ella.

`GET /messages/conversations/:id/messages?before=&limit=` → `{ messages,
next_before }`, orden cronológico.
```
Message = { id, conversation_id, body: string|null, removed, risk: 'none'|'high',
            created_at, read, is_own }
```
`body` es `null` cuando `removed` (moderación lo quitó tras un reporte).
`risk: 'high'` marca un mensaje con lenguaje de crisis (se entregó igual).

`POST /messages/conversations` `{ publicId, body }` → 201 `{ conversation,
moderation: { outcome: 'delivered', reason: null|'crisis' } }`. Abre (o
reabre) la conversación con `publicId` y manda `body` como primer mensaje —
es la solicitud. Errores: `not_found` (no existe, sin alias, o hay bloqueo),
`falta_nombre` (quien escribe no tiene alias), 403 `mensajes_desactivados`,
403 `no_se_siguen_mutuamente`, `texto_invalido` (vacío o >1000), 400
`mensaje_no_entregado` `{ reason: 'acoso_o_amenaza'|'datos_personales' }`
(el filtro lo retuvo, nunca se guarda), 429 `demasiadas_solicitudes` (más de
5 conversaciones nuevas por día — reabrir una que ya existe no cuenta), 429
`demasiados_mensajes` (más de 60 por hora).

`POST /messages/conversations/:id/messages` `{ body }` → 201 `{ message,
moderation }` — mismo filtro y mismos códigos de error. Mientras la
conversación siga `pending`, solo quien la pidió puede escribir, y una sola
vez: 409 `solicitud_pendiente`. Sobre una `rejected`: 409
`conversacion_rechazada`.

`POST /messages/conversations/:id/accept` → 200 `{ ok, conversation }` — solo
quien la recibió. 409 `estado_invalido` si no está `pending` o si quien pide
aceptar es quien la mandó.
`POST /messages/conversations/:id/reject` → 200 `{ ok }` — igual, solo quien
la recibió. Rechazar no avisa al remitente con detalle.
`POST /messages/conversations/:id/read` → 200 `{ ok }` — marca leído lo
ajeno.

`POST /messages/:messageId/report` `{ reason, detail? }` — mismas categorías
que `report_reason` (`self_harm, harassment, spam, personal_info, other`),
solo quien participa en la conversación. Crea un caso en el panel de
moderación: el moderador ve solo ese mensaje y hasta 5 alrededor, nunca el
historial completo (`GET /admin/messages/reports`, ver abajo), y queda en la
bitácora (`access_audit`).

Bloquear no tiene ruta propia: `POST /users/:publicId/block` con
`conversation.other.public_id` — el otro participante siempre tiene alias.
Bloquear en cualquier sentido oculta la conversación de ambas listas.

## Retos

`GET /challenges` → `{ challenges: [{ key, title, total_days, joined,
completed_days, completed_at, checked_today }] }` (`title` según `?lang=es|en`)
`POST /challenges/:key/join` · `DELETE /challenges/:key` (abandonar)
`POST /challenges/:key/progress` — una vez por día; suma un día y marca
`completed_at` al llegar a `total_days`. Dos veces el mismo día: 409 `ya_registrado_hoy`.
Acepta `{ date: 'AAAA-MM-DD' }` para el día local del cliente.

## Administración (panel web)

Moderación v2: dos niveles, `is_moderator()` ('moderator' o 'admin') e
`is_admin()` (solo 'admin'). El panel muestra solo las pestañas que el rol
puede usar (`/auth/me.role`).

**Exige `is_moderator()`** — cola, reportes y protocolo de crisis:
- `GET /admin/queue` incluye `risk`, `screening_note`, `held_reason`,
  `support_sent_at`, `crisis_handled_at`, `crisis_handled_note` y conteo de
  reportes. Crisis primero (`risk='high'`), después por antigüedad.
- Al quedar algo retenido por crisis, y cada hora si sigue sin atenderse más
  de 30 minutos (`api/src/alerts.js`), cada `moderator`/`admin` recibe una
  notificación `moderation_alert` en la campanita (además del correo, que sin
  SMTP configurado solo queda en el log). Nunca rompe ni retrasa la
  publicación que lo dispara — ver la nota de `notifications.kind` arriba.
- `GET /admin/reports` → reportes abiertos de publicaciones y comentarios.
- `POST /admin/reports/:id/dismiss` · `POST /admin/posts/:id/moderate { action: 'publish'|'reject'|'remove' }`
  (también `POST /admin/comments/:id/moderate`).
- Aprobar o rechazar notifica al autor (`post_approved`, `post_rejected`, …).
- `POST /admin/posts/:id/support` (también `.../comments/:id/support`) —
  protocolo de crisis, solo sobre `held_reason='crisis'`. Crea para el autor
  una notificación `support_sent` **sin revelar su identidad al moderador**:
  se resuelve entero con `service_role` dentro de la transacción. Una vez por
  publicación/comentario — repetir da 409 `estado_invalido`.
- `POST /admin/posts/:id/attend { note? }` (también `.../comments/:id/attend`)
  — marca como atendido, con nota interna opcional (≤500 caracteres, 400
  `nota_invalida` si se excede). La nota **nunca** sale en el contrato de la
  app — solo la ve el panel. Se puede repetir (actualiza la nota).
- Todas estas acciones quedan en `moderation_actions` (`support_sent`,
  `crisis_handled`, además de `publish`/`reject`/`remove`/`dismiss_report`).
- Reportes de mensajes privados: `GET /admin/messages/reports` → casos
  abiertos (`id, message_id, reason, detail, created_at`) — nunca quién
  reportó. `GET /admin/messages/reports/:id/context` → `{ messages }`, el
  mensaje reportado y hasta 5 alrededor de esa conversación (con quién lo
  mandó), nunca el historial completo; leerlo queda en `access_audit`.
  `POST /admin/messages/reports/:id/dismiss` → descarta sin acción.
  `POST /admin/messages/:messageId/remove` → oculta ese mensaje puntual
  (`removed: true`, sin borrar la fila) y cierra sus reportes abiertos.

**Exige `is_admin()`** — Explorar, usuarios y estadísticas (decisión de
producto, no técnica: ver `20260814000006_explore_and_admin.sql`):
- `GET /admin/stats` → conteos generales (usuarios, publicaciones por estado,
  reportes abiertos). **Nunca** conteos ni datos del diario por persona.
- `GET|POST /admin/explore`, `PATCH|DELETE /admin/explore/:id`.
- `GET /admin/users`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id`.

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
