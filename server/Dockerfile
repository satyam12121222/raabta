FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY admin.mjs backup.mjs ./
RUN mkdir -p /data /backups && chown node:node /data /backups
USER node
ENV HOST=0.0.0.0 PORT=8080 DB_PATH=/data/raabta.db
EXPOSE 8080
CMD ["node", "src/server.mjs"]
