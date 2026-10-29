FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY public/ /app/public/

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]

