# Despliegue de la base de datos

Postgres autoalojado para Raíz. **Todavía no está desplegado en ningún servidor**
— este directorio está probado en local y listo para subir.

> Los datos de conexión al servidor **no están en este repositorio**, porque es
> público. Viven en la skill `vps-raiz`, fuera del repo.

## Por qué Postgres normal y no Supabase

El servidor de destino comparte máquina con otro proyecto en producción y tiene
3.8 GB de RAM. Supabase autoalojado son unos ocho contenedores y 1.5–2 GB; un
Postgres solo son ~300 MB.

Las migraciones del esquema (`../supabase/migrations/`) usan `auth.users` y
`auth.uid()`, que en Supabase vienen dados. `migrations/00000000000000_auth_compat.sql`
los crea aquí, así que **el mismo esquema corre en ambos sitios sin cambios**. Si
algún día se migra a Supabase, ese único archivo deja de aplicarse.

## Cómo funciona la identidad

El backend valida el token del proveedor de identidad de la UPB y, en cada
petición, dentro de una transacción:

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
```

`auth.uid()` lee de ahí y todas las políticas de seguridad funcionan igual que
en Supabase.

> ⚠️ El `true` final es obligatorio: hace el ajuste local a la transacción. Sin
> él el valor persiste en la conexión y, con un pool, la siguiente petición
> heredaría la identidad de la anterior — una fuga de datos entre usuarios.

## Contenido

```
docker-compose.yml    Postgres 16, sin puertos publicados, con techo de recursos
migrations/           capa de compatibilidad de identidad (se aplica primero)
apply-migrations.sh   aplica compat + esquema + políticas, en orden, y lleva registro
                      de qué ya se aplicó (raiz_meta.schema_migrations)
baseline-sentinels.sh objeto centinela de cada migración: --baseline no marca
                      como aplicada una migración cuyo centinela falte
create-app-role.sh    crea el rol de la app y verifica que no burle la seguridad
backup.sh             pg_dump verificado, cifrado (age/gpg) si hay clave, con
                      rotación a 14 días
restore.sh            restauración; pide confirmación salvo --force
.env.example          plantilla de configuración
```

## Dos usuarios, y la diferencia importa

| Rol | Para qué | Seguridad |
|---|---|---|
| `raiz_admin` | migraciones, respaldos, mantenimiento | **Dueño de las tablas → las políticas NO le aplican** |
| `raiz_app` | conexión del backend | No es dueño, `nobypassrls`, `noinherit` → sujeto a todas |

En Postgres el dueño de una tabla no está sujeto a Row Level Security. Si la app
se conectara con `raiz_admin`, todas las políticas quedarían anuladas y cualquiera
podría leer el diario de cualquiera. Por eso existe `raiz_app`.

Es **NOINHERIT** a propósito: no hereda los permisos de `authenticated`, tiene
que pedirlos con `set role` en cada transacción. Eso hace explícito en el código
cuándo se está actuando en nombre de una persona, y hace que el olvido falle
cerrado — sin `set role`, Postgres deniega en vez de mostrar de más.

## Primera vez

```bash
cp .env.example .env
# generar ambas contraseñas de Postgres con -hex, no -base64 — ver .env.example
# para por qué (APP_DB_PASSWORD viaja dentro de una URL de conexión):
#   openssl rand -hex 32
chmod 600 .env

docker compose up -d
bash apply-migrations.sh
bash create-app-role.sh
```

Se esperan **19 tablas con RLS activo, 49 políticas, 22 migraciones
registradas**, y las 6 comprobaciones del rol de aplicación en verde. Si algo no cuadra, parar y revisar antes de meter un
solo dato.

Después, programar el respaldo diario:

```
0 3 * * * /srv/raiz/backup.sh >> /srv/raiz/backups/backup.log 2>&1
```

### Respaldos cifrados

El volcado contiene el diario de todas las personas. La app promete que nadie
en ella puede leerlo, así que el respaldo no puede quedar como un archivo
legible cualquiera: `backup.sh` corre con `umask 077` (el archivo y la carpeta
solo los lee quien respalda) y **cifra** el volcado si en `deploy/.env` (o en
el entorno de cron) hay una de estas variables:

| Variable | Herramienta | Resultado |
|---|---|---|
| `BACKUP_RECIPIENT=age1…` | [`age`](https://age-encryption.org) con clave pública | `raiz-….dump.age` |
| `BACKUP_PASSPHRASE=…` | `gpg --symmetric` (AES256) | `raiz-….dump.gpg` |

Se recomienda `age`: en la máquina solo vive la clave **pública**; la privada se
guarda fuera (con quien custodie los respaldos), así que quien entre al
servidor no puede descifrar los respaldos viejos. Con `gpg` la frase tiene que
estar en el `.env`, en la misma máquina.

```bash
age-keygen -o raiz-backup.key          # FUERA del servidor; imprime la clave pública
echo 'BACKUP_RECIPIENT=age1...' >> deploy/.env
```

Sin ninguna de las dos, el script avisa por consola que el respaldo queda **sin
cifrar**. Si se definió una y falta la herramienta, se niega a respaldar en vez
de dejar un volcado en claro.

Restaurar uno cifrado: `restore.sh` lo descifra a un temporal con
`BACKUP_PASSPHRASE` (`.gpg`) o `BACKUP_IDENTITY=/ruta/a/raiz-backup.key` (`.age`).

## Actualizar una base que ya está en uso

`apply-migrations.sh` aplica **solo lo nuevo**: cada migración corre en una
transacción junto con su fila en `raiz_meta.schema_migrations` (esquema aparte,
invisible para la app). Si una falla, se revierte entera y no queda registrada.

```bash
bash apply-migrations.sh --status    # qué está aplicado y qué no
bash apply-migrations.sh             # aplica lo pendiente
```

**Una sola vez, en una base creada antes del registro** (septiembre de 2026 —
la del servidor): esa base tiene aplicadas las migraciones hasta
`20260814000007_admin_user_grants.sql` pero ningún registro, y las primeras no
se pueden volver a correr sobre datos (`create type`, `create table` sin
`if not exists`). Por eso el script **se niega** a seguir sobre una base con
esquema y sin registro, y hay que correr (antes de marcar nada, `--baseline`
comprueba el objeto centinela de cada migración —`deploy/baseline-sentinels.sh`—
y se niega con la lista de lo que falta si la base no lo tiene de verdad):

```bash
bash backup.sh                         # antes de tocar el esquema, siempre
bash apply-migrations.sh --baseline    # marca 0000…–20260814000007 como aplicadas
                                       # (sin ejecutarlas) y aplica las nuevas
bash create-app-role.sh                # vuelve a comprobar el rol contra el esquema nuevo
```

Si la base hubiera quedado en otro punto, `--baseline-until=<archivo.sql>` marca
hasta ese archivo. Las migraciones de 20260923 en adelante están escritas para
aplicarse sobre datos existentes (`if not exists`, `drop policy if exists`,
los perfiles existentes reciben su `public_id` en la misma migración).

## Convivencia con el otro proyecto

Esta máquina aloja **Acueducto Rural UPB en producción**. Todo aquí lleva prefijo
`raiz` (contenedor `raiz-db`, red `raiz_net`, volumen `raiz_pgdata`) para que en
cualquier listado se distinga de un vistazo qué es nuestro.

Tres decisiones concretas salen de esa convivencia:

- **`mem_limit: 512m`** — si tenemos una fuga de memoria, el kernel mata nuestro
  contenedor y no el suyo.
- **Sin sección `ports`** — Postgres no se publica al host. Su CouchDB hace lo
  mismo; hay precedente en la misma máquina.
- **nginx propio en otro contenedor** cuando toque servir HTTPS. Añadir un
  `server` block al nginx del acueducto está prohibido: acopla los proyectos.

Las reglas completas, incluidos los comandos vetados (`docker system prune` y
compañía, que borran por patrón y se llevarían lo del acueducto), están en la
skill `vps-raiz`.

## Verificado en local

Ciclo completo, no solo el arranque:

| | |
|---|---|
| Migraciones aplicadas | 19 tablas con RLS, 49 políticas, 22 migraciones registradas |
| Las 12 pruebas de seguridad | Pasan contra este despliegue, no solo contra el shim |
| Aislamiento | `docker port raiz-db` no devuelve nada |
| Límite de memoria | 512 MB aplicado |
| Rol de aplicación | 6 comprobaciones: no lee sin `set role`, ve solo su diario (check-in y libre) con él, no es superusuario ni dueño |
| `--baseline` | Probado sobre una base creada con el script anterior y con datos: marca las 12 viejas, aplica las 9 nuevas, los perfiles existentes reciben `public_id` |
| Respaldo | Generado y verificado con `pg_restore --list` |
| **Restauración** | Tabla borrada a propósito y recuperada, con datos y políticas intactos |

## Pendientes antes de datos reales

- **HTTPS.** El puerto 443 (o cualquier otro, TLS no exige el 443) lo debe abrir
  el CTIC. Bloquea el piloto con estudiantes reales, no el desarrollo: mientras
  se construya con datos falsos, HTTP basta.
- **Motor de migraciones.** `apply-migrations.sh` ya lleva registro (ver arriba)
  pero no revierte migraciones ni detecta conflictos entre ramas. Para el
  piloto alcanza; si el equipo crece, evaluar sqitch o dbmate.
- **Respaldos fuera de la máquina.** Un respaldo en el mismo disco que la base no
  protege de la pérdida del disco.
