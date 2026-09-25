# Imagen del API de Raíz.
#
# El contexto de build es la RAÍZ del repositorio (ver deploy/docker-compose.yml,
# build.context: ..), no api/. Antes el contexto era solo api/ y el API no podía
# ver admin-web/ para servir /panel y /descargar desde el mismo origen; mover el
# contexto es más simple que duplicar admin-web/ dentro de api/ a mano.
#
# Dentro de la imagen replicamos la misma disposición que en el repo — api/ y
# admin-web/ como hermanos bajo /app — para que server.js pueda ubicar
# admin-web/ con la misma ruta relativa ('../../admin-web' desde api/src) tanto
# en local como en Docker, sin variables de entorno ni casos especiales.
FROM node:22-alpine

# Cliente de Postgres para el healthcheck del contenedor y para diagnosticar
# desde dentro sin instalar nada en caliente.
RUN apk add --no-cache postgresql16-client

WORKDIR /app

# Las dependencias primero: mientras package*.json no cambie, esta capa se
# reutiliza y el despliegue no vuelve a bajar node_modules.
COPY api/package*.json ./api/
RUN cd api && npm ci --omit=dev && npm cache clean --force

COPY api/src ./api/src
# Panel de administración y página de descarga: HTML estático, sin build.
COPY admin-web ./admin-web

WORKDIR /app/api

# node:alpine ya trae el usuario `node` sin privilegios. Correr como root dentro
# del contenedor no aporta nada aquí y amplía el daño si algo sale mal.
USER node

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
