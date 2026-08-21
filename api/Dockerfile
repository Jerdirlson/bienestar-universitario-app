# Imagen del API de Raíz.
FROM node:22-alpine

# Cliente de Postgres para el healthcheck del contenedor y para diagnosticar
# desde dentro sin instalar nada en caliente.
RUN apk add --no-cache postgresql16-client

WORKDIR /app

# Las dependencias primero: mientras package*.json no cambie, esta capa se
# reutiliza y el despliegue no vuelve a bajar node_modules.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

# node:alpine ya trae el usuario `node` sin privilegios. Correr como root dentro
# del contenedor no aporta nada aquí y amplía el daño si algo sale mal.
USER node

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
