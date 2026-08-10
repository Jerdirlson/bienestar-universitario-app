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
apply-migrations.sh   aplica compat + esquema + políticas, en orden
backup.sh             pg_dump verificado, con rotación a 14 días
restore.sh            restauración; pide confirmación salvo --force
.env.example          plantilla de configuración
```

## Primera vez

```bash
cp .env.example .env
# generar contraseña:  openssl rand -base64 32
chmod 600 .env

docker compose up -d
bash apply-migrations.sh
```

Se esperan **9 tablas con RLS activo y 21 políticas**. Si el número no cuadra,
parar y revisar antes de meter un solo dato.

Después, programar el respaldo diario:

```
0 3 * * * /srv/raiz/backup.sh >> /srv/raiz/backups/backup.log 2>&1
```

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
| Migraciones aplicadas | 9 tablas con RLS, 21 políticas |
| Las 12 pruebas de seguridad | Pasan contra este despliegue, no solo contra el shim |
| Aislamiento | `docker port raiz-db` no devuelve nada |
| Límite de memoria | 512 MB aplicado |
| Respaldo | Generado y verificado con `pg_restore --list` |
| **Restauración** | Tabla borrada a propósito y recuperada, con datos y políticas intactos |

## Pendientes antes de datos reales

- **HTTPS.** El puerto 443 lo debe abrir el CTIC. Sin eso no se despliega nada.
- **Rol de aplicación aparte.** El usuario del `.env` es dueño de la base y pasa
  por encima de las políticas por ser propietario. La app debe conectarse con un
  rol sin privilegios de propietario que asuma `authenticated`.
- **Motor de migraciones.** `apply-migrations.sh` no lleva registro de qué se
  aplicó. Para el piloto alcanza; antes de producción, pasar a sqitch o dbmate.
- **Respaldos fuera de la máquina.** Un respaldo en el mismo disco que la base no
  protege de la pérdida del disco.
